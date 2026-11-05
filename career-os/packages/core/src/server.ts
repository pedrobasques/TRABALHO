/**
 * Server-only data loading (uses node:fs). Never import from client code.
 *
 * Source selection via CAREER_OS_DATA_SOURCE:
 *   demo        — synthetic dataset (default when no career-ops data exists)
 *   career-ops  — read-only adapter over career-ops user files
 *   auto        — career-ops if data/applications.md or data/scan-history.tsv exists, else demo
 */
import { existsSync, readFileSync } from 'node:fs';
import { join as pathJoin, resolve } from 'node:path';

/** Runtime-only path join (user data is read at request time, never bundled). */
const join = (...parts: string[]) => pathJoin(/* turbopackIgnore: true */ ...parts);
import type { CandidateProfile, Dataset } from './domain/types.ts';
import { buildDemoDataset } from './data/demo/index.ts';
import { DEMO_PROFILE } from './data/demo/profile.ts';
import { parseApplicationsMd, parseStatusLog, scanHistoryToJobs, trackerToDomain } from './data/career-ops/parse.ts';
import { buildProfileFromCareerOps } from './data/career-ops/profile.ts';
import { dedupeJobs, normalizeJob } from './ingest/normalize.ts';
import { AUTOMATION_CATALOG } from './automation/catalog.ts';

export type SourceSetting = 'demo' | 'career-ops' | 'auto';

export function careerOpsRoot(): string {
  return resolve(/* turbopackIgnore: true */ process.env.CAREER_OPS_ROOT ?? join(process.cwd(), '..', '..', 'upstream', 'career-ops'));
}

export function careerOpsDataPresent(root = careerOpsRoot()): { applications: boolean; scanHistory: boolean; cv: boolean; profile: boolean } {
  return {
    applications: existsSync(join(root, 'data', 'applications.md')),
    scanHistory: existsSync(join(root, 'data', 'scan-history.tsv')),
    cv: existsSync(join(root, 'cv.md')),
    profile: existsSync(join(root, 'config', 'profile.yml')),
  };
}

const EMPTY_PROFILE: CandidateProfile = {
  ...DEMO_PROFILE,
  origin: 'career-ops',
  displayName: 'Perfil não importado',
  headline: '—',
  summary: 'O perfil do career-ops ainda não é lido pelo Career OS (Fase 2). Nenhum dado pessoal foi inferido.',
  yearsExperience: null,
  skills: [],
  languages: [],
  eligibility: [],
  education: [],
  experience: [],
  achievements: [],
  certifications: [],
  goals: [],
};

export function loadCareerOpsDataset(root = careerOpsRoot()): Dataset {
  const notes: string[] = [`Lendo arquivos do career-ops em ${root} (somente leitura).`];
  const read = (p: string) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : null);
  const apps = read('data/applications.md');
  const log = read('data/status-log.tsv');
  const scan = read('data/scan-history.tsv');
  const tracker = apps ? trackerToDomain(parseApplicationsMd(apps), log ? parseStatusLog(log) : []) : { jobs: [], applications: [], warnings: ['data/applications.md ausente.'] };
  notes.push(...tracker.warnings);
  const scanned = scan ? scanHistoryToJobs(scan) : [];
  if (!scan) notes.push('data/scan-history.tsv ausente (nenhuma coleta executada).');
  // Level 1–2: normalize + dedupe everything that came from real files.
  const deduped = dedupeJobs([...tracker.jobs, ...scanned].map(normalizeJob));
  if (deduped.duplicates.length) notes.push(`${deduped.duplicates.length} vaga(s) duplicada(s) mesclada(s) na normalização.`);
  const keep = new Map(deduped.jobs.map((n) => [n.job.id, { ...n.job, qualityIssues: n.issues }]));
  for (const d of deduped.duplicates) {
    for (const a of tracker.applications) if (a.jobId === d.dropped) a.jobId = d.kept;
  }
  const jobs = [...keep.values()];

  const extPath = join(process.env.CAREER_OS_PRIVATE_DIR ?? join(process.cwd(), '..', '..', 'private'), 'profile-extension.yml');
  let imported: ReturnType<typeof buildProfileFromCareerOps>;
  try {
    imported = buildProfileFromCareerOps(read('cv.md'), read('config/profile.yml'), existsSync(extPath) ? readFileSync(extPath, 'utf8') : null);
  } catch (e) {
    imported = { ...buildProfileFromCareerOps(null, null), notes: [`Falha ao ler o perfil: ${(e as Error).message.split('\n')[0]}`] };
  }
  const profile = { ...imported.profile, importReport: { unknowns: imported.unknowns, notes: imported.notes, sources: imported.sources } };
  const dates = jobs.map((j) => j.discoveredAt).filter((d) => d > '1970-01-01').sort();
  return {
    origin: 'career-ops',
    asOf: new Date().toISOString().slice(0, 10),
    jobs,
    applications: tracker.applications,
    profile: profile.importReport.sources.length ? profile : { ...EMPTY_PROFILE, importReport: profile.importReport },
    automations: AUTOMATION_CATALOG,
    runs: [],
    sourceNotes: [...notes, dates.length ? `Período dos dados: ${dates[0]} → ${dates[dates.length - 1]}` : 'Nenhuma vaga encontrada.'],
  };
}

export function resolveSource(setting = (process.env.CAREER_OS_DATA_SOURCE ?? 'auto') as SourceSetting): 'demo' | 'career-ops' {
  if (setting === 'demo' || setting === 'career-ops') return setting;
  const p = careerOpsDataPresent();
  return p.applications || p.scanHistory ? 'career-ops' : 'demo';
}

export function loadDataset(): Dataset {
  return resolveSource() === 'career-ops' ? loadCareerOpsDataset() : buildDemoDataset();
}

export { FilePipelineStore } from './persistence/file-store.ts';
export { parseCvMarkdown, buildProfileFromCareerOps, skillKeyFor, type ProfileImport, type ProfileExtension, type ParsedCv } from './data/career-ops/profile.ts';
