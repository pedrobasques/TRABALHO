/**
 * Read-only adapters for career-ops' canonical files. Pure functions over
 * text so they can be tested with synthetic fixtures; file access lives in
 * ../../server.ts. Career OS never writes these files — status changes keep
 * going through career-ops' own scripts (set-status.mjs).
 *
 * Formats (career-ops v1.38.0):
 *  - data/applications.md: markdown table
 *    | # | Date | Company | Via | Role | Score | Status | PDF | Report | Notes |
 *  - data/status-log.tsv: {tracker#}\t{date}\t{from}\t{to}\t{source}\t{note}
 *  - data/scan-history.tsv: columns per lib/scan-history-columns.mjs
 *  - templates/states.yml: canonical statuses + aliases
 */
import type { Application, Job, PipelineStage, StageEvent } from '../../domain/types.ts';

export interface TrackerRow {
  num: string;
  date: string;
  company: string;
  via: string;
  role: string;
  /** Parsed "4.2/5" → 4.2; null when absent or malformed. */
  score: number | null;
  status: string;
  report: string | null;
  notes: string;
}

function splitRow(line: string): string[] {
  // strip the leading/trailing pipe, split on unescaped pipes
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return inner.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

export function parseApplicationsMd(text: string): TrackerRow[] {
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => /^\s*\|\s*#\s*\|/.test(l));
  if (headerIdx < 0) return [];
  const header = splitRow(lines[headerIdx]!).map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const rows: TrackerRow[] = [];
  for (const line of lines.slice(headerIdx + 1)) {
    if (!line.trim().startsWith('|')) {
      if (rows.length) break;
      continue;
    }
    if (/^\s*\|\s*-+/.test(line)) continue; // separator
    const cells = splitRow(line);
    const get = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? '') : '');
    const num = get('#');
    if (!num) continue;
    const scoreMatch = /^(\d+(?:\.\d+)?)\s*\/\s*5/.exec(get('score'));
    const reportMatch = /\]\(([^)]+)\)/.exec(get('report'));
    rows.push({
      num,
      date: get('date'),
      company: get('company'),
      via: get('via'),
      role: get('role'),
      score: scoreMatch ? Number(scoreMatch[1]) : null,
      status: get('status'),
      report: reportMatch ? reportMatch[1]! : null,
      notes: get('notes'),
    });
  }
  return rows;
}

/** career-ops canonical state id → Career OS stage. Unknown → null. */
const STATE_TO_STAGE: Record<string, PipelineStage> = {
  evaluated: 'qualified',
  applied: 'submitted',
  responded: 'responded',
  assessment: 'responded',
  interview: 'interview',
  offer: 'offer',
  hired: 'offer',
  rejected: 'closed',
  discarded: 'closed',
  skip: 'closed',
};

/** Minimal alias table (subset of templates/states.yml); callers may pass the parsed YAML aliases. */
export const DEFAULT_STATE_ALIASES: Record<string, string> = {
  evaluada: 'evaluated', condicional: 'evaluated', hold: 'evaluated',
  aplicado: 'applied', enviada: 'applied', aplicada: 'applied', sent: 'applied',
  respondido: 'responded', screening: 'assessment', 'online assessment': 'assessment',
  entrevista: 'interview', oferta: 'offer', rechazado: 'rejected', rechazada: 'rejected',
  descartado: 'discarded', descartada: 'discarded', 'no aplicar': 'skip',
};

export function normalizeState(raw: string, aliases: Record<string, string> = DEFAULT_STATE_ALIASES): string | null {
  const s = raw.replace(/\*\*/g, '').trim().toLowerCase();
  if (!s || s === '-') return null;
  if (s in STATE_TO_STAGE) return s;
  return aliases[s] ?? null;
}

export function stateToStage(state: string | null): PipelineStage | null {
  return state ? (STATE_TO_STAGE[state] ?? null) : null;
}

export interface StatusLogRow {
  num: string;
  date: string;
  from: string | null;
  to: string;
  source: string;
  note: string;
}

export function parseStatusLog(text: string): StatusLogRow[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.split('\t'))
    .filter((c) => c.length >= 4 && /^\d+$/.test(c[0]!.trim()))
    .map((c) => ({
      num: String(Number(c[0]!.trim())),
      date: c[1]!.trim(),
      from: c[2]!.trim() === '-' ? null : c[2]!.trim(),
      to: c[3]!.trim(),
      source: (c[4] ?? '').trim(),
      note: (c[5] ?? '').trim(),
    }));
}

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Build Career OS jobs + applications from tracker rows.
 * career-ops tracker rows describe evaluated offers, so each becomes one Job
 * (requirements unknown → the matching engine reports low confidence) and one
 * Application.
 */
export function trackerToDomain(rows: TrackerRow[], log: StatusLogRow[] = [], aliases?: Record<string, string>): { jobs: Job[]; applications: Application[]; warnings: string[] } {
  const jobs: Job[] = [];
  const applications: Application[] = [];
  const warnings: string[] = [];
  for (const r of rows) {
    const num = String(Number(r.num));
    const state = normalizeState(r.status, aliases);
    const stage = stateToStage(state);
    if (!stage) warnings.push(`Linha #${r.num}: status "${r.status}" não reconhecido — tratado como "qualified".`);
    const jobId = `co-${num}-${slug(r.company)}`;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null;
    if (!date) warnings.push(`Linha #${r.num}: data "${r.date}" inválida.`);
    jobs.push({
      id: jobId,
      origin: 'career-ops',
      title: r.role,
      normalizedTitle: r.role,
      company: r.company,
      sector: '—',
      area: 'other',
      country: '??',
      city: null,
      workMode: 'unknown',
      seniority: 'unknown',
      description: r.notes,
      requirements: [],
      salary: null,
      postedAt: null,
      discoveredAt: date ?? '1970-01-01',
      verifiedAt: null,
      status: stage === 'closed' ? 'closed' : 'unverified',
      source: { name: r.via && r.via !== '—' ? r.via : 'career-ops tracker', url: null },
      careerOpsScore: r.score,
      visaSponsorship: 'unknown',
    });
    const events: StageEvent[] = log
      .filter((l) => l.num === num)
      .map((l) => ({ stage: stateToStage(normalizeState(l.to, aliases)) ?? 'qualified', at: l.date, note: l.note || l.source }))
      .sort((a, b) => a.at.localeCompare(b.at));
    const finalStage = stage ?? 'qualified';
    const history: StageEvent[] = events.length ? events : [{ stage: 'qualified', at: date ?? '1970-01-01', note: 'Avaliada (career-ops)' }];
    if (history[history.length - 1]!.stage !== finalStage) history.push({ stage: finalStage, at: date ?? history[history.length - 1]!.at, note: 'Status atual do tracker' });
    // A rejection implies the application had been submitted.
    if (state === 'rejected' && !history.some((h) => h.stage === 'submitted')) {
      history.splice(history.length - 1, 0, { stage: 'submitted', at: history[history.length - 1]!.at, note: 'Inferido de "Rejected"' });
    }
    const app: Application = {
      id: `co-app-${num}`,
      origin: 'career-ops',
      jobId,
      stage: finalStage,
      history,
      nextAction: null,
      nextActionDue: null,
      notes: r.notes,
    };
    if (state === 'rejected') app.closedReason = 'rejected';
    else if (state === 'discarded' || state === 'skip') app.closedReason = 'discarded';
    else if (state === 'hired') app.closedReason = 'hired';
    applications.push(app);
  }
  return { jobs, applications, warnings };
}

export const SCAN_HISTORY_COLUMNS = [
  'url', 'first_seen', 'portal', 'title', 'company', 'status', 'location', 'fingerprint',
  'posted_at', 'trust_score', 'trust_flags', 'normalized_company', 'requisition_id', 'language', 'listing_key',
] as const;

/** scan-history.tsv rows → discovered jobs (no requirements; Level 1 data only). */
export function scanHistoryToJobs(text: string): Job[] {
  const out: Job[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = line.split('\t').map((c) => c.replace(/^'(?=[=+\-@])/, ''));
    // Legacy layout (career-ops ≤ v1.18): url, first_seen, title.
    const legacy = cells.length === 3;
    const get = (k: (typeof SCAN_HISTORY_COLUMNS)[number]) =>
      legacy ? (k === 'url' ? cells[0]! : k === 'first_seen' ? cells[1]! : k === 'title' ? cells[2]! : '') : (cells[SCAN_HISTORY_COLUMNS.indexOf(k)] ?? '');
    if (get('url') === 'url' || !/^https?:\/\//.test(get('url'))) continue;
    const loc = get('location');
    const country = /\b(Brazil|Brasil)\b/i.test(loc) ? 'BR' : /\bItal/i.test(loc) ? 'IT' : /\b(Germany|Deutschland)\b/i.test(loc) ? 'DE' : /\b(Spain|España)\b/i.test(loc) ? 'ES' : /\bNetherlands\b/i.test(loc) ? 'NL' : /\b(United States|USA)\b/i.test(loc) ? 'US' : /\bAustralia\b/i.test(loc) ? 'AU' : '??';
    const first = get('first_seen').slice(0, 10);
    out.push({
      id: `scan-${get('listing_key') || get('fingerprint') || slug(get('url'))}`,
      origin: 'career-ops',
      title: get('title') || '(sem título)',
      normalizedTitle: get('title') || '(sem título)',
      company: get('company') || 'Empresa não informada',
      sector: '—',
      area: 'other',
      country,
      city: loc || null,
      workMode: /remote/i.test(loc) ? 'remote' : 'unknown',
      seniority: 'unknown',
      description: '',
      requirements: [],
      salary: null,
      postedAt: get('posted_at') ? get('posted_at').slice(0, 10) : null,
      discoveredAt: first || '1970-01-01',
      verifiedAt: null,
      status: /closed|expired|dead/i.test(get('status')) ? 'closed' : 'unverified',
      source: { name: get('portal') || 'scan', url: get('url') },
      careerOpsScore: null,
      visaSponsorship: 'unknown',
    });
  }
  return out;
}
