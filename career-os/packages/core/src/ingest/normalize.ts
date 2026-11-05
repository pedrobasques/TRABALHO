/**
 * Opportunity normalization and deduplication (Levels 1–2: deterministic, zero AI cost).
 *
 * Applied to every job that enters Career OS from a real source (career-ops tracker,
 * career-ops scan-history). Demo jobs are already normalized.
 */
import type { CountryCode, Job, JobArea, Seniority, WorkMode } from '../domain/types.ts';

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const COMPANY_SUFFIXES =
  /\b(inc|incorporated|llc|ltd|limited|plc|gmbh|ag|se|kg|co|corp|corporation|company|s\.?a\.?|s\.?p\.?a\.?|s\.?r\.?l\.?|ltda|b\.?v\.?|n\.?v\.?|pty|group|holding|holdings)\b\.?/g;

export function normalizeCompany(name: string): string {
  return fold(name)
    .replace(/&/g, ' and ')
    .replace(COMPANY_SUFFIXES, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Title key for dedup: lowercase, no accents, gender markers and punctuation removed. */
export function normalizeTitleKey(title: string): string {
  return fold(title)
    .replace(/\((m|w|f|d|x|h)(\s*\/\s*(m|w|f|d|x|h))*\)/g, ' ') // (m/w/d), (h/f)
    .replace(/\b(m|w|f|d)\/(m|w|f|d)(\/(m|w|f|d))?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Canonical URL key: host + path, no query/fragment/trailing slash, lowercase host. */
export function urlKey(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

/** Stable identity for "the same opening": company + title + country. */
export function jobDedupeKey(job: Pick<Job, 'company' | 'title' | 'country'>): string {
  const country = /^[A-Z]{2}$/.test(job.country) ? job.country : 'XX';
  return `${normalizeCompany(job.company) || 'unknown'}|${normalizeTitleKey(job.title) || 'untitled'}|${country}`;
}

/* ---------------------------------------------------------------- detection */

const COUNTRY_PATTERNS: [CountryCode, RegExp][] = [
  ['BR', /\b(brazil|brasil|sao paulo|rio de janeiro|belo horizonte|betim|contagem|campinas|curitiba|porto alegre|recife|salvador|sete lagoas|ipatinga|itabira|manaus|joinville|sorocaba|sao jose dos campos|minas gerais|\bmg\b|\bsp\b)\b/],
  ['IT', /\b(italy|italia|milan|milano|turin|torino|rome|roma|bologna|modena|genoa|genova|naples|napoli|florence|firenze|venice|venezia|brescia|bergamo|verona|padova)\b/],
  ['DE', /\b(germany|deutschland|berlin|munich|munchen|hamburg|stuttgart|cologne|koln|frankfurt|dusseldorf|wolfsburg|ingolstadt|nuremberg|nurnberg|bremen|hannover|leipzig|dresden)\b/],
  ['ES', /\b(spain|espana|madrid|barcelona|valencia|bilbao|seville|sevilla|zaragoza|malaga|vigo|pamplona)\b/],
  ['NL', /\b(netherlands|nederland|holland|amsterdam|rotterdam|eindhoven|utrecht|the hague|den haag|venlo|delft|groningen)\b/],
  ['BE', /\b(belgium|belgie|belgique|brussels|bruxelles|antwerp|antwerpen|ghent|gent|liege|leuven)\b/],
  ['GB', /\b(united kingdom|\buk\b|england|scotland|wales|london|glasgow|edinburgh|manchester|birmingham|aberdeen|bristol)\b/],
  ['US', /\b(united states|\busa\b|\bu\.s\.|new york|california|texas|michigan|detroit|chicago|seattle|boston|atlanta|houston|wichita|ohio|illinois|remote us)\b/],
  ['AU', /\b(australia|sydney|melbourne|brisbane|perth|adelaide|canberra|queensland|new south wales|victoria au)\b/],
  ['PT', /\b(portugal|lisbon|lisboa|porto)\b/],
  ['FR', /\b(france|paris|lyon|toulouse|marseille)\b/],
  ['CH', /\b(switzerland|schweiz|suisse|zurich|geneva|geneve|basel)\b/],
  ['IE', /\b(ireland|dublin|cork)\b/],
  ['CA', /\b(canada|toronto|montreal|vancouver|ottawa)\b/],
];

export function detectCountry(location: string | null | undefined): CountryCode | null {
  if (!location) return null;
  const s = ` ${fold(location)} `;
  const hits = COUNTRY_PATTERNS.filter(([, re]) => re.test(s)).map(([c]) => c);
  return hits.length === 1 ? hits[0]! : null; // ambiguous (multi-country) → unknown, never guessed
}

export function detectWorkMode(text: string | null | undefined): WorkMode {
  const s = fold(text ?? '');
  if (/\bhybrid|hibrido|ibrido|hybride\b/.test(s)) return 'hybrid';
  if (/\bremote|remoto|home office|homeoffice|telelavoro|teletrabajo\b/.test(s)) return 'remote';
  if (/\bon-?site|presencial|in office\b/.test(s)) return 'onsite';
  return 'unknown';
}

export function detectSeniority(title: string): Seniority {
  const s = fold(title);
  if (/\b(director|diretor|directeur|head of|vp|vice president|leiter|chief)\b/.test(s)) return 'director';
  if (/\b(manager|gerente|gestor|responsabile|jefe|manager)\b/.test(s)) return 'manager';
  if (/\b(lead|coordinator|coordenador|coordinador|team lead|principal|staff)\b/.test(s)) return 'lead';
  if (/\b(senior|sr\.?|senior|sênior|experienced)\b/.test(s)) return 'senior';
  if (/\b(junior|jr\.?|graduate|trainee|estagiario|intern|praktikant|apprentice|entry)\b/.test(s)) return 'junior';
  if (/\b(pleno|mid|ii)\b/.test(s)) return 'mid';
  return 'unknown';
}

const AREA_RULES: [JobArea, RegExp][] = [
  ['project_management', /\b(project|projeto|projetos|proyecto|progetto|projekt|program|programme|pmo|portfolio|portifolio)\b/],
  ['digital_manufacturing', /\b(digital|industry 4|industria 4|smart (factory|manufacturing)|mes|manufacturing technology|transformation|transformacao)\b/],
  ['operational_excellence', /\b(continuous improvement|melhoria continua|lean|six sigma|operational excellence|excelencia operacional|kaizen|opex)\b/],
  ['automation', /\b(automation|automacao|automatizacion|plc|clp|robotics|controls engineer)\b/],
  ['supply_chain', /\b(supply chain|logistics|logistica|procurement|warehouse|planning|s&op|demand planner)\b/],
  ['process_engineering', /\b(process engineer|engenheiro de processos|ingeniero de procesos|manufacturing engineer|production engineer|engenharia de processos)\b/],
  ['industrial_engineering', /\b(industrial engineer|engenharia industrial|engenheiro industrial|ingegnere|industrial|plant engineer|mechanical engineer|engenheiro mecanico)\b/],
];

export function detectArea(title: string): JobArea {
  const s = fold(title);
  for (const [area, re] of AREA_RULES) if (re.test(s)) return area;
  return 'other';
}

/* ---------------------------------------------------------------- normalize */

export interface NormalizedJob {
  job: Job;
  dedupeKey: string;
  urlKey: string | null;
  issues: string[];
}

/** Fills deterministic fields that a source left unknown; records what is still missing. Never invents values. */
export function normalizeJob(input: Job): NormalizedJob {
  const job: Job = { ...input };
  const issues: string[] = [];
  const locationText = [job.city, job.description.slice(0, 400)].filter(Boolean).join(' ');

  if (!/^[A-Z]{2}$/.test(job.country)) {
    const c = detectCountry(job.city ?? '');
    if (c) job.country = c;
    else issues.push('País não identificado');
  }
  if (job.workMode === 'unknown') job.workMode = detectWorkMode(locationText + ' ' + job.title);
  if (job.seniority === 'unknown') job.seniority = detectSeniority(job.title);
  if (job.area === 'other') job.area = detectArea(job.title);
  if (!job.title || job.title === '(sem título)') issues.push('Cargo ausente');
  if (!job.company || job.company === 'Empresa não informada') issues.push('Empresa ausente');
  if (!job.description.trim()) issues.push('Descrição ausente');
  if (job.requirements.length === 0) issues.push('Requisitos não extraídos');
  if (!job.postedAt) issues.push('Data de publicação desconhecida');
  if (!job.source.url) issues.push('Sem link para a fonte original');

  return { job, dedupeKey: jobDedupeKey(job), urlKey: urlKey(job.source.url), issues };
}

export interface DedupeResult {
  jobs: NormalizedJob[];
  duplicates: { kept: string; dropped: string; reason: 'url' | 'identity' }[];
}

/**
 * Merges duplicates by URL key first, then by company|title|country identity.
 * The survivor keeps the earliest discovery date, the latest verification, the
 * richest record (more requirements / description), and the career-ops score if any.
 */
export function dedupeJobs(items: NormalizedJob[]): DedupeResult {
  const byUrl = new Map<string, NormalizedJob>();
  const byKey = new Map<string, NormalizedJob>();
  const duplicates: DedupeResult['duplicates'] = [];
  const out: NormalizedJob[] = [];

  const richness = (n: NormalizedJob) => n.job.requirements.length * 10 + n.job.description.length / 100 + (n.job.careerOpsScore != null ? 5 : 0);

  for (const n of items) {
    const existing = (n.urlKey && byUrl.get(n.urlKey)) || byKey.get(n.dedupeKey);
    if (!existing) {
      out.push(n);
      if (n.urlKey) byUrl.set(n.urlKey, n);
      byKey.set(n.dedupeKey, n);
      continue;
    }
    const reason = n.urlKey && byUrl.get(n.urlKey) === existing ? 'url' : 'identity';
    const [winner, loser] = richness(n) > richness(existing) ? [n, existing] : [existing, n];
    const merged: NormalizedJob = {
      ...winner,
      job: {
        ...winner.job,
        discoveredAt: [winner.job.discoveredAt, loser.job.discoveredAt].sort()[0]!,
        verifiedAt: [winner.job.verifiedAt, loser.job.verifiedAt].filter(Boolean).sort().pop() ?? null,
        postedAt: winner.job.postedAt ?? loser.job.postedAt,
        careerOpsScore: winner.job.careerOpsScore ?? loser.job.careerOpsScore,
        source: winner.job.source.url ? winner.job.source : loser.job.source,
        status: winner.job.status === 'closed' || loser.job.status === 'closed' ? 'closed' : winner.job.status,
      },
      urlKey: winner.urlKey ?? loser.urlKey,
      issues: winner.issues.filter((i) => loser.issues.includes(i)),
    };
    const idx = out.indexOf(existing);
    out[idx] = merged;
    for (const k of [n.urlKey, existing.urlKey, merged.urlKey]) if (k) byUrl.set(k, merged);
    byKey.set(existing.dedupeKey, merged);
    byKey.set(n.dedupeKey, merged);
    duplicates.push({ kept: merged.job.id, dropped: loser.job.id, reason });
  }
  return { jobs: out, duplicates };
}
