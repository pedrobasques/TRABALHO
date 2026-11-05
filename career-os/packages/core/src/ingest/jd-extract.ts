/**
 * Deterministic requirement extraction from job-description text (no AI).
 * Only explicit statements become requirements; everything else stays unknown.
 * Requirements found in "required/qualifications" sections are `must`; in
 * "preferred/nice to have" sections `nice`; matches only in the general text are
 * ignored (a responsibility is not a requirement).
 */
import type { CountryCode, Job, LanguageLevel, Requirement, Salary } from '../domain/types.ts';

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const MUST_HEAD = /(the essentials|you will have|essential (skills|requirements)|key (skills|requirements)|skills (and|&) experience|what we('re| are) looking for|requirements?|qualifications?|what you('ll)? (bring|need)|you (have|bring)|must[- ]have|required|basic qualifications|minimum qualifications|who you are|your profile|about you|requisitos?|qualificac\w+|o que (esperamos|buscamos)|perfil|anforderungen|dein profil|ihr profil|was du mitbringst|requisiti|competenze|profilo|requisitos imprescindibles|vereisten|functie-eisen)/;
const NICE_HEAD = /(the preferred|you might also have|preferred qualifications|nice[- ]to[- ]have|preferred|bonus|plus|desirable|good to have|diferencia(l|is)|desejave(l|is)|wunschenswert|von vorteil|nice if|gewenst|preferibil|valorables?)/;
const OTHER_HEAD = /(responsibilit|what you('ll)? do|the role|your (role|tasks|mission)|about (us|the (team|company))|benefits|we offer|why join|atividades|responsabilidades|aufgaben|deine aufgaben|mansioni|wat ga je doen|compensation|pay|salary)/;

export const SKILL_PATTERNS: Record<string, { label: string; re: RegExp }> = {
  project_management: { label: 'Gestão de projetos', re: /project management|project manager|gestao de projetos|gerenciamento de projetos|gestion de proyectos|projektmanagement|gestione (dei )?progetti/ },
  pmo: { label: 'PMO / portfólio', re: /\bpmo\b|portfolio management|program management office/ },
  pmp: { label: 'Certificação PMP', re: /\bpmp\b|pmi certif/ },
  agile: { label: 'Métodos ágeis', re: /\bagile\b|\bscrum\b|kanban|\bsafe\b/ },
  lean_six_sigma: { label: 'Lean Six Sigma', re: /six sigma|green belt|black belt/ },
  continuous_improvement: { label: 'Melhoria contínua / Lean', re: /continuous improvement|\blean\b|kaizen|melhoria continua|kvp\b|5s\b/ },
  process_engineering: { label: 'Engenharia de processos', re: /process engineering|process improvement|process optimi[sz]ation|engenharia de processos/ },
  automotive: { label: 'Setor automotivo', re: /automotive|automobil|automotivo|\boem\b|tier 1/ },
  manufacturing: { label: 'Manufatura / produção', re: /manufacturing|production environment|shop floor|plant operations|chao de fabrica|fertigung|produktion/ },
  capex: { label: 'Projetos CAPEX', re: /capex|capital (projects|equipment)/ },
  supply_chain: { label: 'Supply chain', re: /supply chain|logistics|logistica|procurement|warehouse/ },
  sap: { label: 'SAP', re: /\bsap\b/ },
  mes: { label: 'MES', re: /\bmes\b|manufacturing execution/ },
  plc: { label: 'PLC / controles', re: /\bplc\b|\bclp\b|controls engineering|scada/ },
  cad: { label: 'CAD (SolidWorks, CATIA, NX…)', re: /\bcad\b|solidworks|catia|siemens nx|autocad|creo/ },
  gdt: { label: 'GD&T', re: /gd&t|geometric dimensioning/ },
  pfmea: { label: 'PFMEA / APQP / PPAP', re: /pfmea|fmea|apqp|ppap/ },
  power_bi: { label: 'Power BI', re: /power ?bi/ },
  power_apps: { label: 'Power Apps', re: /power ?apps/ },
  power_automate: { label: 'Power Automate', re: /power ?automate/ },
  data_analysis: { label: 'Análise de dados', re: /data analysis|analytics|\bexcel\b|\bsql\b/ },
  python: { label: 'Python', re: /\bpython\b/ },
  ai_agents: { label: 'IA aplicada', re: /artificial intelligence|\bai\b|machine learning|copilot/ },
  stakeholder_management: { label: 'Gestão de stakeholders', re: /stakeholder/ },
  budget: { label: 'Gestão de orçamento/custos', re: /budget|cost reduction|cost savings|p&l|custos/ },
};

const LANGS: Record<string, { code: string; re: RegExp }> = {
  English: { code: 'en', re: /\benglish|ingles|englisch|inglese|engels\b/ },
  German: { code: 'de', re: /\bgerman|deutsch|alemao|tedesco|duits\b/ },
  Italian: { code: 'it', re: /\bitalian|italiano|italienisch\b/ },
  Spanish: { code: 'es', re: /\bspanish|espanhol|espanol|spanisch|spagnolo\b/ },
  Portuguese: { code: 'pt', re: /\bportuguese|portugues|portugiesisch\b/ },
  Dutch: { code: 'nl', re: /\bdutch|nederlands|holandes|niederlandisch\b/ },
  French: { code: 'fr', re: /\bfrench|frances|franzosisch|francese\b/ },
};

function levelFor(ctx: string): LanguageLevel | null {
  const cefr = /\b(a1|a2|b1|b2|c1|c2)\b/.exec(ctx);
  if (cefr) return cefr[1]!.toUpperCase() as LanguageLevel;
  if (/native|nativo|muttersprach|madrelingua/.test(ctx)) return 'C2';
  if (/fluen|fliessend|verhandlungssicher|fluente|avancad|advanced|proficien|excellent|sehr gute|ottim/.test(ctx)) return 'C1';
  if (/business|good|gute|intermedi|working knowledge|conversation/.test(ctx)) return 'B2';
  return null;
}

type Section = 'must' | 'nice' | 'other';

function sections(text: string): { section: Section; text: string }[] {
  const out: { section: Section; text: string }[] = [];
  let cur: Section = 'other';
  let buf: string[] = [];
  const flush = () => buf.length && out.push({ section: cur, text: buf.join('\n') });
  for (const raw of text.split(/\r?\n/)) {
    const line = fold(raw.trim());
    if (!line) continue;
    const isHead = line.length < 80 && !/^[-*•]/.test(line) && (MUST_HEAD.test(line) || NICE_HEAD.test(line) || OTHER_HEAD.test(line));
    if (isHead) {
      flush();
      buf = [];
      cur = NICE_HEAD.test(line) ? 'nice' : MUST_HEAD.test(line) ? 'must' : 'other';
      continue;
    }
    buf.push(line);
  }
  flush();
  return out;
}

export interface Extraction {
  requirements: Requirement[];
  salary: Salary | null;
  visaSponsorship: Job['visaSponsorship'];
  /** 0..1 — how much structure was found (sections + requirement count). */
  confidence: number;
  notes: string[];
}

export function extractRequirements(jobId: string, jdText: string, jobCountry: CountryCode): Extraction {
  const secs = sections(jdText);
  const hasStructure = secs.some((s) => s.section === 'must');
  const reqs: Requirement[] = [];
  const notes: string[] = [];
  let n = 0;
  const push = (r: Omit<Requirement, 'id'>) => {
    if (reqs.some((x) => x.category === r.category && x.key === r.key && x.language?.code === r.language?.code)) return;
    reqs.push({ id: `${jobId}-x${++n}`, ...r });
  };
  const scoped = hasStructure ? secs.filter((s) => s.section !== 'other') : [];
  if (!hasStructure) notes.push('JD sem seção de requisitos identificável — nenhum requisito inferido do texto geral');

  for (const s of scoped) {
    const kind = s.section === 'must' ? 'must' : 'nice';
    for (const [key, p] of Object.entries(SKILL_PATTERNS)) {
      if (p.re.test(s.text)) push({ kind, category: key === 'pmp' ? 'certification' : 'skill', key, text: p.label });
    }
    const yrs = /(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years|yrs|anos|anos de|años|anni|jahre)/.exec(s.text);
    if (yrs && Number(yrs[1]) <= 25) push({ kind, category: 'experience', minYears: Number(yrs[1]), text: `${yrs[1]}+ anos de experiência` });
    if (/(bachelor|master|degree|b\.?s\.?c?\b|m\.?s\.?c?\b|graduac|bacharel|laurea|studium|diploma|ingenieur)/.test(s.text) && /engineer|engenharia|ingenier|ingegneria|ingenieur|technical/.test(s.text)) {
      push({ kind, category: 'education', key: 'engineering_degree', text: 'Graduação em engenharia' });
    }
    for (const [name, l] of Object.entries(LANGS)) {
      const m = l.re.exec(s.text);
      if (!m) continue;
      const ctx = s.text.slice(Math.max(0, m.index - 60), m.index + 60);
      const level = levelFor(ctx) ?? 'B2';
      push({ kind, category: 'language', language: { code: l.code, level }, text: `${name} ${level}` });
    }
  }

  const all = fold(jdText);
  let visa: Job['visaSponsorship'] = 'unknown';
  if (/(not|unable to|cannot|no) (provide |offer )?(visa )?sponsor|sponsorship (is )?not (available|provided)|without (the need for )?sponsorship/.test(all)) visa = 'not_offered';
  else if (/visa sponsorship (is )?(available|provided|offered)|we (can )?sponsor/.test(all)) visa = 'offered';
  if (/(u\.?s\.? person|itar|ear regulations|u\.?s\.? citizen|security clearance|authori[sz]ed to work in the (u\.?s|united states))/.test(all)) {
    push({ kind: 'must', category: 'eligibility', country: 'US', text: 'Autorização de trabalho / pessoa dos EUA (ITAR/cidadania)' });
  } else if (/(right to work in the uk|eligible to work in the uk)/.test(all)) {
    push({ kind: 'must', category: 'eligibility', country: 'GB', text: 'Autorização de trabalho no Reino Unido' });
  } else if (/(eu work permit|eligible to work in the eu|arbeitserlaubnis)/.test(all)) {
    push({ kind: 'must', category: 'eligibility', country: jobCountry, text: 'Autorização de trabalho na UE' });
  }

  let salary: Salary | null = null;
  const sal = /(\$|€|£|r\$)\s?(\d{2,3}(?:[.,]\d{3})+|\d{2,3}k)\s*(?:-|–|to|a)\s*(?:\$|€|£|r\$)?\s?(\d{2,3}(?:[.,]\d{3})+|\d{2,3}k)/.exec(jdText.toLowerCase());
  if (sal) {
    const num = (x: string) => (x.endsWith('k') ? Number(x.slice(0, -1)) * 1000 : Number(x.replace(/[.,]/g, '')));
    const cur = { $: 'USD', '€': 'EUR', '£': 'GBP', r$: 'BRL' }[sal[1] as '$'] ?? 'USD';
    const min = num(sal[2]!);
    const max = num(sal[3]!);
    if (min >= 1000 && max >= min) salary = { min, max, currency: cur, period: max < 20000 ? 'month' : 'year' };
  }

  const confidence = Math.min(1, (hasStructure ? 0.5 : 0) + Math.min(0.5, reqs.length * 0.07));
  return { requirements: reqs, salary, visaSponsorship: visa, confidence, notes };
}
