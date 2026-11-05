import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryPipelineStore, PipelineError, toApplication } from '../src/persistence/pipeline.ts';
import { FilePipelineStore } from '../src/persistence/file-store.ts';
import { runPipelineContract } from './pipeline-contract.ts';

runPipelineContract('memory', async () => new InMemoryPipelineStore());

const dir = mkdtempSync(join(tmpdir(), 'cos-pipeline-'));
let n = 0;
runPipelineContract(
  'file',
  async () => new FilePipelineStore(join(dir, `p${n++}.json`)),
  async (s) => new FilePipelineStore(s.location),
);

test('file: written with 0600 permissions and valid JSON', async () => {
  const p = join(dir, 'perm.json');
  const s = new FilePipelineStore(p);
  const { buildDemoJobs } = await import('../src/data/demo/jobs.ts');
  await s.add(buildDemoJobs()[0]!);
  assert.equal(statSync(p).mode & 0o777, 0o600);
  assert.equal(JSON.parse(readFileSync(p, 'utf8')).version, 1);
});

test('file: corrupt file surfaces an "unavailable" error instead of silently resetting', async () => {
  const p = join(dir, 'corrupt.json');
  writeFileSync(p, '{not json');
  await assert.rejects(() => new FilePipelineStore(p).list(), (e: unknown) => e instanceof PipelineError && e.code === 'unavailable');
  assert.equal(readFileSync(p, 'utf8'), '{not json', 'corrupt file must be left untouched for inspection');
});

test('toApplication maps events to dashboard history', async () => {
  const s = new InMemoryPipelineStore();
  const { buildDemoJobs } = await import('../src/data/demo/jobs.ts');
  const j = buildDemoJobs()[2]!;
  await s.add(j);
  const app = toApplication(await s.move(j.id, 'qualified', 'ok'));
  assert.equal(app.jobId, j.id);
  assert.deepEqual(app.history.map((h) => h.stage), ['discovered', 'qualified']);
  assert.equal(app.history[1]!.note, 'ok');
});
