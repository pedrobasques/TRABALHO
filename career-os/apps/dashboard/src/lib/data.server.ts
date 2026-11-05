import 'server-only';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, accessSync, constants } from 'node:fs';
import { join as pathJoin, resolve } from 'node:path';
import type { Dataset } from '@career-os/core';
import { loadDataset, careerOpsDataPresent, resolveSource, careerOpsRoot } from '@career-os/core/server';

const join = (...p: string[]) => pathJoin(/* turbopackIgnore: true */ ...p);

export type ActiveSource = 'demo' | 'career-ops' | 'database';

/**
 * CAREER_OS_DATA_SOURCE = auto | demo | career-ops | database.
 * auto: database when DATABASE_URL+CAREER_OS_OWNER_ID are set and the career-ops files are absent
 * (the Vercel case); otherwise career-ops files if present; otherwise demo.
 */
export function activeSource(): ActiveSource {
  const want = (process.env.CAREER_OS_DATA_SOURCE ?? 'auto').toLowerCase();
  const dbReady = Boolean(process.env.DATABASE_URL && process.env.CAREER_OS_OWNER_ID);
  if (want === 'database') return 'database';
  if (want === 'auto' && dbReady && resolveSource() === 'demo') return 'database';
  return resolveSource(want as 'demo' | 'career-ops' | 'auto');
}

export async function getDataset(): Promise<Dataset> {
  if (activeSource() !== 'database') return loadDataset();
  const notes: string[] = ['Fonte: banco de dados (espelho do career-ops via npm run radar -- --db).'];
  const { DATABASE_URL, CAREER_OS_OWNER_ID } = process.env;
  if (!DATABASE_URL || !CAREER_OS_OWNER_ID) throw new Error('CAREER_OS_DATA_SOURCE=database requer DATABASE_URL e CAREER_OS_OWNER_ID');
  const dbm = await import('@career-os/db');
  const db = sharedDb(dbm, DATABASE_URL);
  const [jobs, snap] = await Promise.all([dbm.loadJobs(db, CAREER_OS_OWNER_ID), dbm.loadProfileSnapshot(db, CAREER_OS_OWNER_ID)]);
  const base = loadDataset(); // only for the automation catalogue; never mixes demo jobs in
  const profile = snap ?? {
    ...base.profile,
    origin: 'career-ops' as const,
    displayName: 'Perfil não sincronizado',
    headline: '—',
    summary: 'Nenhum snapshot de perfil no banco. Rode npm run radar -- --db numa máquina com cv.md/profile.yml.',
    yearsExperience: null,
    currentSeniority: 'unknown' as const,
    targetSeniority: [],
    skills: [],
    languages: [],
    eligibility: [],
    education: [],
    experience: [],
    achievements: [],
    certifications: [],
    preferences: { countries: {}, areas: {}, workModes: [], minAnnualSalaryEur: null },
    goals: [],
    importReport: { unknowns: ['Perfil não sincronizado no banco'], notes: [], sources: [] },
  };
  if (!snap) notes.push('Perfil ausente no banco — matching sem perfil (tudo desconhecido).');
  if (!jobs.length) notes.push('Nenhuma vaga no banco — rode a ingestão com --db.');
  return {
    origin: 'career-ops',
    asOf: new Date().toISOString().slice(0, 10),
    jobs,
    applications: [],
    profile,
    automations: base.automations,
    runs: [],
    sourceNotes: notes,
  };
}

type DbModule = typeof import('@career-os/db');
let pool: { url: string; db: ReturnType<DbModule['createDb']> } | null = null;
function sharedDb(dbm: DbModule, url: string) {
  if (!pool || pool.url !== url) pool = { url, db: dbm.createDb({ connectionString: url }) };
  return pool.db;
}

export function getSourceStatus() {
  return { active: activeSource(), setting: process.env.CAREER_OS_DATA_SOURCE ?? 'auto', root: careerOpsRoot(), files: careerOpsDataPresent() };
}

/** career-ops code dir (set-status.mjs) and data root, for tracker write-back. */
export function careerOpsSyncConfig() {
  return {
    codeDir: resolve(/* turbopackIgnore: true */ process.env.CAREER_OPS_CODE_DIR ?? join(process.cwd(), '..', '..', 'upstream', 'career-ops')),
    dataRoot: careerOpsRoot(),
  };
}

/** Real list of CV templates shipped by career-ops (read at request time). */
export function getCvTemplates(): string[] {
  const dir = join(careerOpsRoot(), 'templates');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^(cv|resume)-template.*\.(html|tex)$/.test(f)).sort();
}

/* ---------------------------------------------------------------- diagnostics */

export function privateDir(): string {
  return resolve(/* turbopackIgnore: true */ process.env.CAREER_OS_PRIVATE_DIR ?? join(process.cwd(), '..', '..', 'private'));
}

export interface DiagnosticCheck {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
}

export interface DiagnosticRun {
  id: string;
  at: string;
  checks: DiagnosticCheck[];
  summary: { ok: number; warn: number; fail: number };
}

/** Fixed, read-only checks. No user input, no network, no secrets in output. */
export function runDiagnostics(): DiagnosticRun {
  const checks: DiagnosticCheck[] = [];
  const [maj, min] = process.versions.node.split('.').map(Number) as [number, number];
  checks.push({ id: 'node', label: 'Node.js ≥ 22.18', status: maj > 22 || (maj === 22 && min >= 18) ? 'ok' : 'fail', detail: process.version });

  const root = careerOpsRoot();
  const hasRoot = existsSync(join(root, 'package.json'));
  let version = '—';
  try {
    version = readFileSync(join(root, 'VERSION'), 'utf8').split(/\s/)[0] ?? '—';
  } catch {
    /* missing */
  }
  checks.push({ id: 'career-ops', label: 'career-ops vendorizado', status: hasRoot ? 'ok' : 'fail', detail: hasRoot ? `v${version}` : 'não encontrado' });
  checks.push({ id: 'career-ops-deps', label: 'Dependências do career-ops', status: existsSync(join(root, 'node_modules', 'js-yaml')) ? 'ok' : 'warn', detail: existsSync(join(root, 'node_modules', 'js-yaml')) ? 'instaladas' : 'rode career-os/scripts/setup.sh' });

  const f = careerOpsDataPresent(root);
  checks.push({ id: 'cv', label: 'cv.md (currículo mestre)', status: f.cv ? 'ok' : 'warn', detail: f.cv ? 'presente' : 'ausente — onboarding pendente' });
  checks.push({ id: 'profile', label: 'config/profile.yml', status: f.profile ? 'ok' : 'warn', detail: f.profile ? 'presente' : 'ausente — onboarding pendente' });
  checks.push({ id: 'portals', label: 'portals.yml (fontes de vagas)', status: existsSync(join(root, 'portals.yml')) ? 'ok' : 'warn', detail: existsSync(join(root, 'portals.yml')) ? 'presente' : 'ausente — coleta bloqueada' });
  const src = resolveSource();
  checks.push({ id: 'source', label: 'Fonte de dados do dashboard', status: src === 'demo' ? 'warn' : 'ok', detail: src === 'demo' ? 'demonstração (sem dados reais)' : 'career-ops' });

  const browser = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const hasBrowser = (browser && existsSync(browser)) || existsSync('/opt/pw-browsers');
  checks.push({ id: 'browser', label: 'Chromium (PDF / liveness)', status: hasBrowser ? 'ok' : 'warn', detail: hasBrowser ? 'disponível' : 'não detectado — npx playwright install chromium' });

  const pdir = privateDir();
  let writable = false;
  try {
    mkdirSync(pdir, { recursive: true });
    accessSync(pdir, constants.W_OK);
    writable = true;
  } catch {
    /* not writable */
  }
  checks.push({ id: 'private', label: 'Armazenamento privado local', status: writable ? 'warn' : 'fail', detail: writable ? 'gravável, mas local/efêmero — persistência definitiva na Fase 6' : 'sem permissão de escrita' });
  checks.push({ id: 'scheduler', label: 'Agendador 24/7', status: 'warn', detail: 'não configurado (sem host persistente)' });

  const summary = { ok: 0, warn: 0, fail: 0 };
  for (const c of checks) summary[c.status]++;
  return { id: `diag-${Date.now()}`, at: new Date().toISOString(), checks, summary };
}

const LOG = () => join(privateDir(), 'diagnostics.jsonl');

export interface IngestRun {
  id: string;
  kind: string;
  status: 'ok' | 'partial' | 'failed';
  startedAt: string;
  finishedAt: string;
  summary: string;
  stats: Record<string, unknown>;
  errors: string[];
}

/** Real ingest runs written by scripts/radar-ingest.ts (local file; never fabricated). */
export function readIngestRuns(limit = 10): IngestRun[] {
  try {
    return readFileSync(join(privateDir(), 'automation-runs.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as IngestRun)
      .slice(-limit)
      .reverse();
  } catch {
    return [];
  }
}

export function saveDiagnosticRun(run: DiagnosticRun): boolean {
  try {
    mkdirSync(privateDir(), { recursive: true });
    appendFileSync(LOG(), JSON.stringify(run) + '\n', 'utf8');
    return true;
  } catch {
    return false;
  }
}

export function readDiagnosticRuns(limit = 20): DiagnosticRun[] {
  try {
    return readFileSync(LOG(), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as DiagnosticRun)
      .slice(-limit)
      .reverse();
  } catch {
    return [];
  }
}
