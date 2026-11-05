import 'server-only';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, accessSync, constants } from 'node:fs';
import { join as pathJoin, resolve } from 'node:path';
import { loadDataset, careerOpsDataPresent, resolveSource, careerOpsRoot } from '@career-os/core/server';

const join = (...p: string[]) => pathJoin(/* turbopackIgnore: true */ ...p);

export function getDataset() {
  return loadDataset();
}

export function getSourceStatus() {
  return { active: resolveSource(), setting: process.env.CAREER_OS_DATA_SOURCE ?? 'auto', root: careerOpsRoot(), files: careerOpsDataPresent() };
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
