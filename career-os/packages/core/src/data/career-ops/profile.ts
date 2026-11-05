/**
 * Real-profile adapters: career-ops `cv.md` + `config/profile.yml`, plus an optional
 * Career OS extension file (private, gitignored) for what career-ops cannot express
 * (e.g. work authorisation "in progress", market priorities).
 *
 * Traceability rules:
 *  - Everything read from cv.md / profile.yml is `declared` (the owner's own statement, not evidence).
 *  - Nothing is inferred into a fact. Estimates (e.g. years from CV dates) are returned
 *    as notes marked as interpretation and are NOT used by matching.
 *  - Missing information is listed in `unknowns`, never filled with defaults.
 */
import { load as loadYaml } from 'js-yaml';
import type { CandidateProfile, CountryEligibility, EligibilityState, Experience, JobArea, LanguageLevel, ProfileSkill, Seniority, WorkMode } from '../../domain/types.ts';
import { detectCountry } from '../../ingest/normalize.ts';

export interface ProfileImport {
  profile: CandidateProfile;
  unknowns: string[];
  notes: string[];
  sources: string[];
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const stripMd = (s: string) => s.replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();

/** Canonical keys for skills the matching engine knows about (aliases → key). */
const SKILL_ALIASES: Record<string, string[]> = {
  project_management: ['project management', 'gestao de projetos', 'gerenciamento de projetos', 'gestion de proyectos', 'project manager'],
  pmo: ['pmo', 'portfolio management', 'governanca de portfolio', 'project management office'],
  continuous_improvement: ['continuous improvement', 'melhoria continua', 'kaizen', 'lean'],
  lean_six_sigma: ['lean six sigma', 'six sigma', 'green belt', 'black belt'],
  process_engineering: ['process engineering', 'engenharia de processos'],
  power_bi: ['power bi', 'powerbi'],
  power_apps: ['power apps', 'powerapps'],
  power_automate: ['power automate'],
  sharepoint: ['sharepoint', 'microsoft 365', 'm365', 'office 365'],
  data_analysis: ['data analysis', 'analise de dados', 'analytics'],
  supply_chain: ['supply chain', 'logistics', 'logistica'],
  ai_agents: ['copilot studio', 'ai agents', 'agentes de ia', 'inteligencia artificial', 'generative ai'],
  python: ['python'],
  sap: ['sap'],
  plc: ['plc', 'clp'],
  mes: ['mes', 'manufacturing execution system'],
  agile: ['agile', 'scrum', 'kanban', 'safe'],
  stakeholder_management: ['stakeholder management', 'gestao de stakeholders'],
};

export function skillKeyFor(label: string): string {
  const s = slug(label).replace(/_/g, ' ');
  for (const [key, aliases] of Object.entries(SKILL_ALIASES)) if (aliases.some((a) => s === a || s.includes(a))) return key;
  return slug(label);
}

interface CvSections {
  [heading: string]: string[];
}

function sections(md: string): CvSections {
  const out: CvSections = {};
  let cur = '_preamble';
  for (const line of md.split(/\r?\n/)) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h && !line.startsWith('###')) {
      cur = slug(h[1]!);
      out[cur] = [];
      continue;
    }
    (out[cur] ??= []).push(line);
  }
  return out;
}

const pick = (s: CvSections, ...names: RegExp[]) => {
  const k = Object.keys(s).find((key) => names.some((re) => re.test(key)));
  return k ? s[k]! : [];
};

const CEFR = /\b(A1|A2|B1|B2|C1|C2)\b/i;
const NATIVE = /\b(native|nativo|nativa|materna|mother tongue|madrelingua|muttersprache)\b/i;
const LANG_CODES: Record<string, string> = {
  portugues: 'pt', portuguese: 'pt', ingles: 'en', english: 'en', espanhol: 'es', spanish: 'es', espanol: 'es',
  italiano: 'it', italian: 'it', alemao: 'de', german: 'de', deutsch: 'de', frances: 'fr', french: 'fr',
  holandes: 'nl', dutch: 'nl', neerlandes: 'nl',
};

export interface ParsedCv {
  summary: string;
  experience: Experience[];
  skills: ProfileSkill[];
  languages: CandidateProfile['languages'];
  education: CandidateProfile['education'];
  certifications: CandidateProfile['certifications'];
  achievementsWithNumbers: number;
  earliestYear: number | null;
}

export function parseCvMarkdown(md: string): ParsedCv {
  const s = sections(md);
  const summary = pick(s, /summary|resumo|perfil|profile|sobre/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ');

  // Experience: "### Company -- Location" then "**Role**" then a date line, then bullets.
  const experience: Experience[] = [];
  let achievementsWithNumbers = 0;
  let earliestYear: number | null = null;
  let cur: Experience | null = null;
  for (const raw of pick(s, /experience|experiencia|work_history|historico/)) {
    const line = raw.trim();
    const h3 = /^###\s+(.+)$/.exec(line);
    if (h3) {
      let head = stripMd(h3[1]!);
      // Older layout: "### Role — Company (2022–2026)" with the dates in the heading.
      const inline = /\((\d{4})\s*[-–—]+\s*(\d{4}|present|presente|atual|current)\)\s*$/i.exec(head);
      if (inline) head = head.slice(0, inline.index).trim();
      const [left, right] = head.split(/\s+(?:--|—|–|\|)\s+/);
      cur = inline
        ? { id: `cv-exp-${experience.length + 1}`, company: right ?? '', role: left ?? '', start: inline[1]!, end: /^\d/.test(inline[2]!) ? inline[2]! : null, summary: '', provenance: 'declared' }
        : { id: `cv-exp-${experience.length + 1}`, company: left ?? '', role: '', start: '', end: null, summary: right ? `Local: ${right}` : '', provenance: 'declared' };
      if (inline) {
        const y = Number(inline[1]);
        earliestYear = earliestYear == null ? y : Math.min(earliestYear, y);
      }
      experience.push(cur);
      continue;
    }
    if (!cur) continue;
    const role = /^\*\*(.+?)\*\*\s*$/.exec(line);
    if (role && !cur.role) {
      cur.role = role[1]!.trim();
      continue;
    }
    const dates = /^(\d{4}(?:-\d{2})?)\s*(?:--|—|–|-|to|a|até)\s*(\d{4}(?:-\d{2})?|present|presente|atual|current|hoje|now)\s*$/i.exec(stripMd(line));
    if (dates && !cur.start) {
      cur.start = dates[1]!;
      cur.end = /^\d/.test(dates[2]!) ? dates[2]! : null;
      const y = Number(dates[1]!.slice(0, 4));
      earliestYear = earliestYear == null ? y : Math.min(earliestYear, y);
      continue;
    }
    if (/^[-*]\s+/.test(line) && /\d/.test(line)) achievementsWithNumbers++;
  }

  // Skills: "- **Category:** a, b, c" or plain "- a, b".
  const skills: ProfileSkill[] = [];
  const seen = new Set<string>();
  for (const raw of pick(s, /skills|competencias|habilidades|conhecimentos/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:[-*]\s+)?(?:\*\*[^*]+\*\*:?\s*)?(.+)$/.exec(line);
    if (!m) continue;
    for (const item of stripMd(m[1]!).split(/\s*[,;·]\s*/)) {
      const label = item.replace(/\.$/, '').trim();
      if (!label || label.length > 60) continue;
      const key = skillKeyFor(label);
      if (seen.has(key)) continue;
      seen.add(key);
      skills.push({ key, label, level: null, provenance: 'declared' });
    }
  }

  // Languages
  const languages: CandidateProfile['languages'] = [];
  for (const raw of pick(s, /languages|idiomas|linguas|lingue|sprachen/)) {
    const line = stripMd(raw.replace(/^[-*]\s+/, ''));
    if (!line) continue;
    const name = slug(line.split(/[\s:(—–-]/)[0] ?? '');
    const code = LANG_CODES[name];
    if (!code) continue;
    const cefr = CEFR.exec(line)?.[1]?.toUpperCase() as LanguageLevel | undefined;
    const level: LanguageLevel | null = cefr ?? (NATIVE.test(line) ? 'native' : null);
    languages.push({ code, label: line.split(/[:(—–]/)[0]!.trim(), level, provenance: 'declared' });
  }

  // Education & certifications
  const education: CandidateProfile['education'] = [];
  const certifications: CandidateProfile['certifications'] = [];
  for (const raw of pick(s, /education|educacao|formacao|certifica/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:[-*]\s+)?(.+)$/.exec(line);
    if (!m) continue;
    const text = stripMd(m[1]!);
    const [title, rest] = text.includes(' — ') || text.includes(' -- ') || text.includes(' – ') ? text.split(/\s+(?:--|—|–)\s+/) : text.split(/,\s+/, 2);
    if (!title) continue;
    if (/certif|pmp|csm|six sigma|green belt|black belt|prince2|capm|itil|scrum master|®/i.test(title)) {
      const key = /pmp/i.test(title) ? 'pmp' : /six sigma|belt/i.test(title) ? 'lean_six_sigma' : slug(title);
      certifications.push({ key, label: title, provenance: 'declared' });
    } else {
      const key = /mba|pos-?gradua|pós|master|mestrado|especializa/i.test(title) ? 'mba' : /engenharia|engineering|ingenier|ingegneria/i.test(title) ? 'engineering_degree' : slug(title);
      const inProgress = /cursando|em andamento|in progress|expected|previs/i.test(text);
      education.push({ id: `cv-edu-${education.length + 1}`, institution: (rest ?? '').replace(/\(\d{4}\)/, '').trim() || '—', degree: title, key, status: inProgress ? 'in_progress' : 'unverified', provenance: 'declared' });
    }
  }

  return { summary, experience, skills, languages, education, certifications, achievementsWithNumbers, earliestYear };
}

/* ------------------------------------------------------------------ profile.yml */

interface ProfileYml {
  candidate?: { full_name?: string; location?: string };
  target_roles?: { primary?: string[] };
  narrative?: { headline?: string; superpowers?: string[] };
  compensation?: { minimum?: string; currency?: string };
  location?: { country?: string; city?: string; authorized_in?: string[]; needs_sponsorship?: boolean; visa_status?: string };
}

/** Optional private extension (CAREER_OS_PRIVATE_DIR/profile-extension.yml). */
export interface ProfileExtension {
  years_experience?: number;
  current_seniority?: Seniority;
  target_seniority?: Seniority[];
  eligibility?: { country: string; status: EligibilityState; basis?: string }[];
  preferences?: { countries?: Record<string, number>; areas?: Partial<Record<JobArea, number>>; work_modes?: WorkMode[]; min_annual_salary_eur?: number };
  goals?: string[];
}

export function parseYaml<T>(text: string): T | null {
  const v = loadYaml(text);
  return v && typeof v === 'object' ? (v as T) : null;
}

function countryCode(name: string): string | null {
  if (/^[A-Z]{2}$/.test(name.trim())) return name.trim();
  return detectCountry(name);
}

/** Builds a CandidateProfile from real files. Any argument may be null (file absent). */
export function buildProfileFromCareerOps(cvMd: string | null, profileYml: string | null, extensionYml: string | null = null): ProfileImport {
  const unknowns: string[] = [];
  const notes: string[] = [];
  const sources: string[] = [];
  const cv = cvMd ? parseCvMarkdown(cvMd) : null;
  const y = profileYml ? parseYaml<ProfileYml>(profileYml) : null;
  const ext = extensionYml ? parseYaml<ProfileExtension>(extensionYml) : null;
  if (cv) sources.push('cv.md');
  else unknowns.push('cv.md ausente — experiências, competências e formação desconhecidas');
  if (y) sources.push('config/profile.yml');
  else unknowns.push('config/profile.yml ausente — metas e autorização de trabalho desconhecidas');
  if (ext) sources.push('profile-extension.yml (Career OS)');

  // Eligibility: profile.yml authorized_in (declared) + extension (supports in_progress / not_authorized).
  const eligibility: CountryEligibility[] = [];
  for (const name of y?.location?.authorized_in ?? []) {
    const c = countryCode(String(name));
    if (c) eligibility.push({ country: c, status: 'authorized', basis: 'declarado em profile.yml (authorized_in)' });
    else notes.push(`authorized_in "${name}" não reconhecido como país`);
  }
  for (const e of ext?.eligibility ?? []) {
    const c = countryCode(e.country);
    if (!c) continue;
    const i = eligibility.findIndex((x) => x.country === c);
    const entry = { country: c, status: e.status, basis: e.basis ?? 'declarado em profile-extension.yml' };
    if (i >= 0) eligibility[i] = entry;
    else eligibility.push(entry);
  }
  if (!eligibility.length) unknowns.push('Autorização de trabalho não declarada para nenhum país — todas as vagas ficarão com elegibilidade "não confirmada"');

  const years = typeof ext?.years_experience === 'number' ? ext.years_experience : null;
  if (years == null) {
    unknowns.push('Anos de experiência não declarados (defina years_experience no profile-extension.yml)');
    if (cv?.earliestYear) notes.push(`Estimativa a partir das datas do CV: ~${new Date().getFullYear() - cv.earliestYear} anos (interpretação — não usada no matching)`);
  }
  if (cv && cv.languages.length === 0) unknowns.push('Idiomas não encontrados no CV (seção "Languages/Idiomas")');
  if (cv) for (const l of cv.languages) if (!l.level) unknowns.push(`Nível de ${l.label} não informado (use CEFR, ex.: B2)`);
  if (cv && cv.achievementsWithNumbers > 0) notes.push(`${cv.achievementsWithNumbers} resultado(s) numérico(s) no CV — declarados; anexe evidências antes de usar em candidaturas`);
  if (!ext?.preferences?.countries) unknowns.push('Prioridade de países não definida (usando prioridade neutra)');

  const profile: CandidateProfile = {
    origin: 'career-ops',
    displayName: y?.candidate?.full_name?.trim() || 'Perfil (career-ops)',
    headline: y?.narrative?.headline ?? (y?.target_roles?.primary ?? []).join(' · ') ?? '',
    summary: cv?.summary || 'Resumo não encontrado no cv.md.',
    yearsExperience: years,
    currentSeniority: ext?.current_seniority ?? 'unknown',
    targetSeniority: ext?.target_seniority ?? [],
    skills: cv?.skills ?? [],
    languages: cv?.languages ?? [],
    eligibility,
    education: cv?.education ?? [],
    experience: cv?.experience ?? [],
    achievements: [],
    certifications: cv?.certifications ?? [],
    preferences: {
      countries: ext?.preferences?.countries ?? {},
      areas: ext?.preferences?.areas ?? {},
      workModes: ext?.preferences?.work_modes ?? [],
      minAnnualSalaryEur: ext?.preferences?.min_annual_salary_eur ?? null,
    },
    goals: ext?.goals ?? y?.target_roles?.primary ?? [],
  };
  return { profile, unknowns, notes, sources };
}
