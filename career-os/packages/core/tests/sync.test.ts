import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryPipelineStore } from '../src/persistence/pipeline.ts';
import { pullFromTracker, pushPending, stageToCareerOpsState, trackerRowOf } from '../src/sync/career-ops-sync.ts';
import { parseApplicationsMd, parseStatusLog, trackerToDomain } from '../src/data/career-ops/parse.ts';

const CODE = join(import.meta.dirname, '..', '..', '..', 'upstream', 'career-ops');
const FIXTURE = join(CODE, 'test-fixtures', 'upgrade', 'state-v1.18'); // synthetic tracker shipped by career-ops

function freshRoot() {
  const root = mkdtempSync(join(tmpdir(), 'cos-sync-'));
  cpSync(FIXTURE, root, { recursive: true });
  return root;
}
const load = (root: string) => {
  const rows = parseApplicationsMd(readFileSync(join(root, 'data', 'applications.md'), 'utf8'));
  return { rows, ...trackerToDomain(rows) };
};

test('stage mapping and row extraction', () => {
  assert.equal(stageToCareerOpsState('submitted'), 'Applied');
  assert.equal(stageToCareerOpsState('closed', 'rejected'), 'Rejected');
  assert.equal(stageToCareerOpsState('preparing'), null);
  assert.equal(trackerRowOf('co-12-acme'), 12);
  assert.equal(trackerRowOf('d01'), null);
});

test('push: dashboard move is written to the real tracker via set-status.mjs, idempotently', async () => {
  const root = freshRoot();
  const { jobs, applications } = load(root);
  const store = new InMemoryPipelineStore();
  const job = jobs.find((j) => j.company === 'Acme')!; // tracker row 1, status Applied
  const base = applications.find((a) => a.jobId === job.id)!;
  await store.add(job, { seedHistory: base.history });
  await store.move(job.id, 'interview', 'teste');
  const rep = await pushPending(store, { codeDir: CODE, dataRoot: root });
  assert.equal(rep.pushed.applied, 1, JSON.stringify(rep));
  // canonical file now says Interview, and the status ledger has the transition
  const after = load(root);
  assert.equal(after.rows.find((r) => r.num === '1')!.status, 'Interview');
  const ledger = parseStatusLog(readFileSync(join(root, 'data', 'status-log.tsv'), 'utf8'));
  assert.ok(ledger.some((l) => l.num === '1' && l.to === 'Interview'));
  // rebuild from the file reproduces the journal's stage → no divergence
  assert.equal(after.applications.find((a) => a.jobId === job.id)!.stage, 'interview');
  // second push: nothing pending
  assert.equal((await pushPending(store, { codeDir: CODE, dataRoot: root })).pushed.applied, 0);
});

test('push: journal-only stages and jobs without tracker rows are marked not_applicable, not lost', async () => {
  const root = freshRoot();
  const { jobs } = load(root);
  const store = new InMemoryPipelineStore();
  const tracked = jobs[0]!;
  await store.add(tracked);
  await store.move(tracked.id, 'preparing');
  const untracked = { ...tracked, id: 'scan-xyz', company: 'Outra', title: 'Outro cargo' };
  await store.add(untracked);
  await store.move(untracked.id, 'submitted');
  const rep = await pushPending(store, { codeDir: CODE, dataRoot: root });
  assert.equal(rep.pushed.applied, 0);
  assert.ok(rep.pushed.notApplicable >= 3);
  const ev = await store.events(untracked.id);
  assert.match(ev.at(-1)!.sync!.detail!, /sem linha no tracker/);
  assert.equal(ev.length, 2, 'journal keeps every event');
});

test('push failure is recorded as failed and retried; later events of that app wait', async () => {
  const store = new InMemoryPipelineStore();
  const root = freshRoot();
  const { jobs } = load(root);
  const job = jobs[0]!;
  await store.add(job);
  await store.move(job.id, 'submitted');
  await store.move(job.id, 'interview');
  let calls = 0;
  const failing = { codeDir: CODE, dataRoot: root, runner: () => (calls++, { status: 2, stdout: '{"error":"tracker locked","code":"lock"}', stderr: '' }) };
  const rep = await pushPending(store, failing);
  assert.equal(rep.pushed.failed, 1);
  assert.equal(calls, 1, 'stops at the first failure to preserve order');
  assert.equal((await store.pendingSync()).length, 2);
  const ok = await pushPending(store, { codeDir: CODE, dataRoot: root });
  assert.equal(ok.pushed.failed, 0);
  assert.equal((await store.pendingSync()).length, 0);
});

test('pull: a status changed by career-ops itself is adopted into the journal as external', async () => {
  const root = freshRoot();
  const { jobs, applications, rows } = load(root);
  const store = new InMemoryPipelineStore();
  const job = jobs.find((j) => j.company === 'Acme')!;
  await store.add(job, { seedHistory: applications.find((a) => a.jobId === job.id)!.history });
  const changed = rows.map((r) => (r.num === '1' ? { ...r, status: 'Rejected' } : r));
  assert.equal(await pullFromTracker(store, changed), 1);
  const ev = (await store.events(job.id)).at(-1)!;
  assert.equal(ev.to, 'closed');
  assert.equal(ev.actor, 'career-ops');
  assert.equal(ev.sync?.state, 'external');
  assert.equal(await pullFromTracker(store, changed), 0, 'idempotent');
});

test('unavailable tracker is reported, nothing is marked', async () => {
  const store = new InMemoryPipelineStore();
  const { jobs } = load(freshRoot());
  await store.add(jobs[0]!);
  const rep = await pushPending(store, { codeDir: CODE, dataRoot: mkdtempSync(join(tmpdir(), 'cos-empty-')) });
  assert.equal(rep.available, false);
  assert.equal((await store.pendingSync()).length, 1);
});
