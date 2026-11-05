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
import { countBy, dedupeJobs, extractRequirements, normalizeJob, parseApplicationsMd, parseStatusLog, scanHistoryToJobs, trackerToDomain, triageJob, triageRank, type NormalizedJob } from '@career-os/core';

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

  // CO is a career-ops DATA root (may differ from the code dir): it only needs to exist.
  if (!existsSync(CO)) throw new Error(`career-ops data root not found: ${CO}`);

  if (flag('--scan')) {
    if (!existsSync(join(CO, 'portals.yml'))) {
      errors.push('scan skipped: portals.yml not configured (copy templates/portals.example.yml and customize)');
    } else {
      const r = spawnSync(process.execPath, ['scan.mjs', '--quiet'], { cwd: join(ROOT, 'upstream', 'career-ops'), env: { ...process.env, CAREER_OPS_ROOT: CO }, encoding: 'utf8', timeout: 15 * 60_000 });
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
  const deduped = dedupeJobs(normalized);
  const duplicates = deduped.duplicates;

  // Level 2 — deterministic triage against the owner's priority areas (tracker rows are always kept).
  const trackerIds = new Set(tracker.jobs.map((j) => j.id));
  const discarded: { id: string; title: string; reason: string }[] = [];
  let jobs = deduped.jobs.filter((n) => {
    if (trackerIds.has(n.job.id) || !flag('--triage')) return true;
    const t = triageJob(n.job);
    if (t.tier) return true;
    discarded.push({ id: n.job.id, title: n.job.title, reason: t.reason });
    return false;
  });

  // Level 3 — qualification: fetch the JD (career-ops fetch-jd.mjs, public ATS API) for the top N only.
  const qi = args.indexOf('--qualify');
  const qualifyN = qi >= 0 ? Number(args[qi + 1] ?? 20) : 0;
  const qualified: { id: string; requirements: number; confidence: number; error?: string }[] = [];
  if (qualifyN > 0) {
    const prio: Record<string, number> = { IT: 1, BR: 1, DE: 0.9, ES: 0.8, NL: 0.8, BE: 0.7, GB: 0.7, AU: 0.7, US: 0.6, CH: 0.6 };
    const ranked = jobs.filter((n) => n.job.source.url && n.job.status !== 'closed').sort((a, b) => triageRank(b.job, prio) - triageRank(a.job, prio))
      // diversify the JD budget: at most 4 per company and 8 per source (portal)
      .filter(((perCo: Map<string, number>, perSrc: Map<string, number>) => (n: NormalizedJob) => {
        const c = (perCo.get(n.job.company) ?? 0) + 1;
        const p = (perSrc.get(n.job.source.name) ?? 0) + 1;
        if (c > 4 || p > 8) return false;
        perCo.set(n.job.company, c);
        perSrc.set(n.job.source.name, p);
        return true;
      })(new Map(), new Map()))
      .slice(0, qualifyN);
    const jdDir = join(OUT, 'radar', 'jd');
    mkdirSync(jdDir, { recursive: true });
    const proxyEnv = process.env.HTTPS_PROXY ? { NODE_USE_ENV_PROXY: '1', CAREER_OPS_TRUST_PROXY_EGRESS: '1' } : {};
    // Gupy is not in fetch-jd.mjs's JD API list; its own provider ships descriptions in the list payload.
    let gupyDesc: Record<string, string> = {};
    if (ranked.some((n) => /\.gupy\.io$/.test(new URL(n.job.source.url!).hostname))) {
      const g = spawnSync(process.execPath, [join(ROOT, 'scripts', 'lib', 'gupy-descriptions.mjs'), CO], { env: { ...process.env, ...proxyEnv }, encoding: 'utf8', timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
      try {
        gupyDesc = JSON.parse(g.stdout || '{}');
      } catch {
        errors.push('descrições Gupy indisponíveis');
      }
    }
    for (const n of ranked) {
      const cache = join(jdDir, `${n.job.id.replace(/[^a-z0-9_-]/gi, '_')}.txt`);
      let text = existsSync(cache) ? readFileSync(cache, 'utf8') : '';
      if (!text) text = gupyDesc[n.job.source.url!] ?? '';
      if (!text) {
        const r = spawnSync(process.execPath, ['fetch-jd.mjs', n.job.source.url!], {
          cwd: join(ROOT, 'upstream', 'career-ops'),
          env: { ...process.env, ...proxyEnv },
          encoding: 'utf8',
          timeout: 60_000,
        });
        text = r.status === 0 ? (r.stdout ?? '').trim() : '';
      }
      if (text && !existsSync(cache)) writeFileSync(cache, text, { mode: 0o600 });
      if (!text) {
        qualified.push({ id: n.job.id, requirements: 0, confidence: 0, error: 'JD indisponível pela API do ATS' });
        n.issues.push('JD não obtida (fetch-jd.mjs sem resposta)');
        continue;
      }
      const ex = extractRequirements(n.job.id, text, n.job.country);
      n.job = { ...n.job, description: text.slice(0, 12000), requirements: ex.requirements, salary: ex.salary ?? n.job.salary, visaSponsorship: ex.visaSponsorship };
      n.issues = n.issues.filter((i) => !/Descrição ausente|Requisitos não extraídos/.test(i)).concat(ex.notes);
      if (!ex.requirements.length) n.issues.push('Requisitos não extraídos');
      qualified.push({ id: n.job.id, requirements: ex.requirements.length, confidence: Math.round(ex.confidence * 100) / 100 });
    }
  }
  const byCountry = Object.fromEntries(countBy(jobs, (n) => n.job.country).map((x) => [x.key, x.count]));
  const issues = Object.fromEntries(countBy(jobs.flatMap((n) => n.issues.map((i) => ({ i }))), (x) => x.i).map((x) => [x.key, x.count]));
  Object.assign(stats, {
    triage: flag('--triage') ? { kept: jobs.length, discarded: discarded.length, sampleDiscarded: discarded.slice(0, 8) } : 'off',
    qualified: { count: qualified.length, withRequirements: qualified.filter((q) => q.requirements > 0).length, failed: qualified.filter((q) => q.error).length },
    possibleReposts: deduped.possibleReposts.length,
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
      const { createDb, upsertIngestedJobs, upsertProfileSnapshot } = await import('@career-os/db');
      const db = createDb({ connectionString: DATABASE_URL });
      try {
        const up = await upsertIngestedJobs(db, CAREER_OS_OWNER_ID, jobs);
        stats.db = { inserted: up.inserted, updated: up.updated, failed: up.failed.length };
        for (const f of up.failed) errors.push(`linha rejeitada pelo banco (${f.jobId}): ${f.error}`);
        // tracker applications → journal (imported history, actor 'import'); idempotent.
        // Later tracker changes reach the journal through `npm run sync` (pull).
        const { PostgresPipelineStore } = await import('@career-os/db');
        const store = new PostgresPipelineStore(db, CAREER_OS_OWNER_ID);
        let adopted = 0;
        for (const app of tracker.applications) {
          const job = jobs.find((n) => n.job.id === app.jobId)?.job;
          if (!job) continue;
          try {
            const r = await store.add(job, { seedHistory: app.history });
            if (r.created) adopted++;
          } catch (e) {
            errors.push(`candidatura ${app.id} não espelhada: ${(e as Error).message}`);
          }
        }
        stats.applicationsAdopted = adopted;
        // profile snapshot for deployments without career-ops files (Vercel)
        const cv = read('cv.md');
        const yml = read('config/profile.yml');
        const extPath = join(OUT, 'profile-extension.yml');
        if (cv || yml || existsSync(extPath)) {
          const { buildProfileFromCareerOps } = await import('@career-os/core/server');
          const imp = buildProfileFromCareerOps(cv, yml, existsSync(extPath) ? readFileSync(extPath, 'utf8') : null);
          const snap = await upsertProfileSnapshot(db, CAREER_OS_OWNER_ID, { ...imp.profile, importReport: { unknowns: imp.unknowns, notes: imp.notes, sources: imp.sources } });
          stats.profileSnapshot = snap.hash;
        } else {
          stats.profileSnapshot = 'skipped (sem cv.md, profile.yml ou profile-extension.yml)';
        }
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
