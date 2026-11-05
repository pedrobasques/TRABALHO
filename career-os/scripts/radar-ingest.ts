#!/usr/bin/env node
/**
 * Career OS radar ingest (Levels 1–2, zero AI cost).
 *
 *   node scripts/radar-ingest.ts [--scan] [--db] [--career-ops <dir>] [--out <dir>] [--json]
 *
 *   --scan        run career-ops' own collector first (`node scan.mjs`, public ATS APIs only,
 *                 requires portals.yml). Without it, only existing files are ingested.
 *   --db          mirror normalized jobs + the run log to Supabase/Postgres
 *                 (needs DATABASE_URL and CAREER_OS_OWNER_ID).
 *   --career-ops  career-ops checkout (default: upstream/career-ops)
 *   --out         output dir (default: $CAREER_OS_PRIVATE_DIR or career-os/private)
 *
 * Outputs (gitignored): <out>/radar/latest.json and an appended <out>/automation-runs.jsonl entry.
 * Exit code: 0 ok/partial, 1 failed.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countBy, dedupeJobs, normalizeJob, parseApplicationsMd, parseStatusLog, scanHistoryToJobs, trackerToDomain, type NormalizedJob } from '@career-os/core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const opt = (f: string, d: string) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? resolve(args[i + 1]!) : d;
};
const CO = opt('--career-ops', join(ROOT, 'upstream', 'career-ops'));
const OUT = opt('--out', resolve(process.env.CAREER_OS_PRIVATE_DIR ?? join(ROOT, 'private')));
const PRIORITY = ['BR', 'IT', 'DE', 'ES', 'NL', 'US', 'AU'];

interface RunLog {
  id: string;
  kind: 'ingest';
  status: 'ok' | 'partial' | 'failed';
  startedAt: string;
  finishedAt: string;
  summary: string;
  stats: Record<string, unknown>;
  errors: string[];
}

async function main(): Promise<RunLog> {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  const stats: Record<string, unknown> = { careerOpsRoot: CO };

  if (!existsSync(join(CO, 'package.json'))) throw new Error(`career-ops not found at ${CO}`);

  if (flag('--scan')) {
    if (!existsSync(join(CO, 'portals.yml'))) {
      errors.push('scan skipped: portals.yml not configured (copy templates/portals.example.yml and customize)');
    } else {
      const r = spawnSync(process.execPath, ['scan.mjs', '--quiet'], { cwd: CO, encoding: 'utf8', timeout: 15 * 60_000 });
      stats.scanExitCode = r.status;
      const tail = (r.stderr || r.stdout || '').trim().split('\n').slice(-5).join(' | ');
      if (r.status !== 0) errors.push(`scan.mjs exited ${r.status}: ${tail.slice(0, 500)}`);
      else stats.scanTail = tail.slice(0, 500);
    }
  }

  const read = (p: string) => (existsSync(join(CO, p)) ? readFileSync(join(CO, p), 'utf8') : null);
  const scanText = read('data/scan-history.tsv');
  const trackerText = read('data/applications.md');
  if (!scanText) errors.push('data/scan-history.tsv not found — no collected jobs yet');
  const scanned = scanText ? scanHistoryToJobs(scanText) : [];
  const tracker = trackerText ? trackerToDomain(parseApplicationsMd(trackerText), parseStatusLog(read('data/status-log.tsv') ?? '')) : { jobs: [], applications: [], warnings: [] };
  errors.push(...tracker.warnings);

  const normalized: NormalizedJob[] = [...tracker.jobs, ...scanned].map(normalizeJob);
  const { jobs, duplicates } = dedupeJobs(normalized);
  const byCountry = Object.fromEntries(countBy(jobs, (n) => n.job.country).map((x) => [x.key, x.count]));
  const issues = Object.fromEntries(countBy(jobs.flatMap((n) => n.issues.map((i) => ({ i }))), (x) => x.i).map((x) => [x.key, x.count]));
  Object.assign(stats, {
    read: { scanHistoryRows: scanned.length, trackerRows: tracker.jobs.length },
    jobs: jobs.length,
    duplicatesMerged: duplicates.length,
    byCountry,
    priorityCoverage: Object.fromEntries(PRIORITY.map((c) => [c, byCountry[c] ?? 0])),
    unknownCountry: byCountry['??'] ?? 0,
    open: jobs.filter((n) => n.job.status === 'open').length,
    closed: jobs.filter((n) => n.job.status === 'closed').length,
    qualityIssues: issues,
  });

  mkdirSync(join(OUT, 'radar'), { recursive: true });
  writeFileSync(join(OUT, 'radar', 'latest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), jobs }, null, 2), { mode: 0o600 });

  if (flag('--db')) {
    const { DATABASE_URL, CAREER_OS_OWNER_ID } = process.env;
    if (!DATABASE_URL || !CAREER_OS_OWNER_ID) {
      errors.push('--db requested but DATABASE_URL / CAREER_OS_OWNER_ID are not set; database mirror skipped');
    } else {
      const { createDb, upsertIngestedJobs } = await import('@career-os/db');
      const db = createDb({ connectionString: DATABASE_URL });
      try {
        stats.db = await upsertIngestedJobs(db, CAREER_OS_OWNER_ID, jobs);
      } catch (e) {
        errors.push(`database mirror failed: ${(e as Error).message}`);
      } finally {
        await db.end();
      }
    }
  }

  const failed = !scanText && !trackerText;
  const status: RunLog['status'] = failed ? 'failed' : errors.length ? 'partial' : 'ok';
  return {
    id: `ingest-${Date.now()}`,
    kind: 'ingest',
    status,
    startedAt,
    finishedAt: new Date().toISOString(),
    summary: `${jobs.length} vaga(s) normalizada(s), ${duplicates.length} duplicata(s) mesclada(s), ${stats.unknownCountry} sem país`,
    stats,
    errors,
  };
}

const run = await main().catch(
  (e: Error): RunLog => ({ id: `ingest-${Date.now()}`, kind: 'ingest', status: 'failed', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), summary: 'falha', stats: {}, errors: [e.message] }),
);
mkdirSync(OUT, { recursive: true });
appendFileSync(join(OUT, 'automation-runs.jsonl'), JSON.stringify(run) + '\n', { mode: 0o600 });

if (flag('--db') && process.env.DATABASE_URL && process.env.CAREER_OS_OWNER_ID) {
  try {
    const { createDb, recordAutomationRun } = await import('@career-os/db');
    const db = createDb({ connectionString: process.env.DATABASE_URL });
    await recordAutomationRun(db, process.env.CAREER_OS_OWNER_ID, run).finally(() => db.end());
  } catch (e) {
    console.error(`could not record run in database: ${(e as Error).message}`);
  }
}

if (flag('--json')) console.log(JSON.stringify(run));
else {
  console.log(`[${run.status}] ${run.summary}`);
  for (const e of run.errors) console.log(`  ! ${e}`);
}
process.exit(run.status === 'failed' ? 1 : 0);
