#!/usr/bin/env node
/**
 * Reconciles the Career OS journal with the canonical career-ops tracker (ADR-008).
 *
 *   npm run sync -- [--db] [--career-ops <dataRoot>] [--dry-run]
 *
 *  1. push: pending dashboard events → set-status.mjs (tracker + status-log.tsv)
 *  2. pull: tracker changes made by career-ops → journal (actor 'career-ops')
 *
 * Store: --db uses Postgres (DATABASE_URL + CAREER_OS_OWNER_ID); otherwise the local
 * file store in CAREER_OS_PRIVATE_DIR/pipeline.career-ops.json.
 * Run it on the machine that holds the career-ops files (laptop/VPS) — never on Vercel.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseApplicationsMd, type PipelineStore } from '@career-os/core';
import { FilePipelineStore, pullFromTracker, pushPending } from '@career-os/core/server';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (f: string, d: string) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? resolve(args[i + 1]!) : d;
};
const CODE = join(ROOT, 'upstream', 'career-ops');
const DATA = opt('--career-ops', resolve(process.env.CAREER_OPS_ROOT ?? CODE));
const PRIV = resolve(process.env.CAREER_OS_PRIVATE_DIR ?? join(ROOT, 'private'));
const startedAt = new Date().toISOString();

let store: PipelineStore;
let close = async () => {};
if (args.includes('--db')) {
  const { DATABASE_URL, CAREER_OS_OWNER_ID } = process.env;
  if (!DATABASE_URL || !CAREER_OS_OWNER_ID) {
    console.error('--db requer DATABASE_URL e CAREER_OS_OWNER_ID');
    process.exit(1);
  }
  const { createDb, PostgresPipelineStore } = await import('@career-os/db');
  const db = createDb({ connectionString: DATABASE_URL });
  store = new PostgresPipelineStore(db, CAREER_OS_OWNER_ID);
  close = () => db.end();
} else {
  store = new FilePipelineStore(join(PRIV, 'pipeline.career-ops.json'));
}

const trackerPath = join(DATA, 'data', 'applications.md');
if (!existsSync(trackerPath)) {
  console.error(`tracker não encontrado: ${trackerPath}`);
  await close();
  process.exit(1);
}

if (args.includes('--dry-run')) {
  const pending = await store.pendingSync();
  console.log(`${pending.length} evento(s) pendente(s):`);
  for (const p of pending) console.log(`  ${p.event.at.slice(0, 10)} ${p.application.job.jobId} → ${p.event.to} [${p.event.sync?.state}]`);
  await close();
  process.exit(0);
}

const rep = await pushPending(store, { codeDir: CODE, dataRoot: DATA });
await pullFromTracker(store, parseApplicationsMd(readFileSync(trackerPath, 'utf8')), rep);
await close();

const status = !rep.available || rep.pushed.failed ? 'partial' : 'ok';
const run = {
  id: `sync-${Date.now()}`,
  kind: 'sync',
  status,
  startedAt,
  finishedAt: new Date().toISOString(),
  summary: `push: ${rep.pushed.applied} aplicado(s), ${rep.pushed.unchanged} sem mudança, ${rep.pushed.notApplicable} só no diário, ${rep.pushed.failed} falha(s); pull: ${rep.pulled}`,
  stats: rep,
  errors: [...(rep.reason ? [rep.reason] : []), ...rep.details.filter((d) => d.startsWith('FALHA'))],
};
mkdirSync(PRIV, { recursive: true });
appendFileSync(join(PRIV, 'automation-runs.jsonl'), JSON.stringify(run) + '\n', { mode: 0o600 });
console.log(`[${status}] ${run.summary}`);
for (const d of rep.details) console.log(`  ${d}`);
process.exit(rep.pushed.failed ? 2 : 0);
