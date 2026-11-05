#!/usr/bin/env node
/**
 * Lossless export of the Career OS journal (applications + every event, incl. sync state).
 *
 *   npm run export -- [--db] [--out <dir>]
 *
 * Writes (gitignored private dir by default):
 *   pipeline-export-<ts>.jsonl   one application per line, complete history — re-importable
 *   pipeline-export-<ts>.tsv     status-log-compatible view: tracker#/job, date, from, to, source, note, sync
 * Nothing is lost when the database is discarded: the JSONL holds every journal event, and
 * the career-ops files (tracker + status-log.tsv) hold every event that has a career-ops state.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PipelineStore } from '@career-os/core';
import { FilePipelineStore, trackerRowOf } from '@career-os/core/server';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const i = args.indexOf('--out');
const PRIV = resolve(process.env.CAREER_OS_PRIVATE_DIR ?? join(ROOT, 'private'));
const OUT = i >= 0 && args[i + 1] ? resolve(args[i + 1]!) : join(PRIV, 'exports');

let store: PipelineStore;
let close = async () => {};
if (args.includes('--db')) {
  const { createDb, PostgresPipelineStore } = await import('@career-os/db');
  const db = createDb({ connectionString: process.env.DATABASE_URL ?? '' });
  store = new PostgresPipelineStore(db, process.env.CAREER_OS_OWNER_ID ?? '');
  close = () => db.end();
} else {
  const origin = process.env.CAREER_OS_EXPORT_ORIGIN ?? 'career-ops';
  store = new FilePipelineStore(join(PRIV, `pipeline.${origin}.json`));
}

const apps = await store.list();
await close();
const ts = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync(OUT, { recursive: true });
const jsonl = apps.map((a) => JSON.stringify(a)).join('\n') + (apps.length ? '\n' : '');
const tsv = [
  ['tracker_or_job', 'date', 'from', 'to', 'source', 'note', 'sync_state'].join('\t'),
  ...apps.flatMap((a) =>
    a.events.map((e) =>
      [trackerRowOf(a.job.jobId) ?? a.job.jobId, e.at.slice(0, 10), e.from ?? '-', e.to, e.actor, (e.note ?? '').replace(/[\t\n]/g, ' '), e.sync?.state ?? 'pending'].join('\t'),
    ),
  ),
].join('\n') + '\n';
writeFileSync(join(OUT, `pipeline-export-${ts}.jsonl`), jsonl, { mode: 0o600 });
writeFileSync(join(OUT, `pipeline-export-${ts}.tsv`), tsv, { mode: 0o600 });
console.log(`exportado: ${apps.length} candidatura(s), ${apps.reduce((n, a) => n + a.events.length, 0)} evento(s) → ${OUT}`);
