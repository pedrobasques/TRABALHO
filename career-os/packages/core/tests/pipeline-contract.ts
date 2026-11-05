/**
 * Behavioural contract every PipelineStore implementation must satisfy.
 * Imported by the memory/file tests here and by the Postgres test in @career-os/db.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Job } from '../src/domain/types.ts';
import { PipelineError, type PipelineStore } from '../src/persistence/pipeline.ts';
import { buildDemoJobs } from '../src/data/demo/jobs.ts';

export function runPipelineContract(name: string, make: () => Promise<PipelineStore>, reopen?: (s: PipelineStore) => Promise<PipelineStore>) {
  const jobs = buildDemoJobs();
  const j1 = jobs[0]!;
  const j2 = jobs[1]!;

  test(`${name}: add creates one application with a 'discovered' event`, async () => {
    const s = await make();
    const { application, created } = await s.add(j1);
    assert.equal(created, true);
    assert.equal(application.stage, 'discovered');
    assert.equal(application.events.length, 1);
    assert.equal(application.events[0]!.from, null);
    assert.equal(application.job.jobId, j1.id);
    assert.equal((await s.list()).length, 1);
  });

  test(`${name}: add is idempotent (no duplicates by job id or identity)`, async () => {
    const s = await make();
    await s.add(j1);
    const again = await s.add(j1);
    assert.equal(again.created, false);
    const twin: Job = { ...j1, id: `${j1.id}-repost`, title: `  ${j1.title.toUpperCase()} ` }; // same company/title/country
    const dup = await s.add(twin);
    assert.equal(dup.created, false, 'same identity must not create a second application');
    assert.equal((await s.list()).length, 1);
  });

  test(`${name}: move appends history with from/to and keeps order`, async () => {
    const s = await make();
    await s.add(j1);
    await s.move(j1.id, 'qualified', 'triagem ok');
    const app = await s.move(j1.id, 'preparing');
    assert.equal(app.stage, 'preparing');
    const ev = await s.events(j1.id);
    assert.deepEqual(ev.map((e) => [e.from, e.to]), [[null, 'discovered'], ['discovered', 'qualified'], ['qualified', 'preparing']]);
    assert.equal(ev[1]!.note, 'triagem ok');
  });

  test(`${name}: moving to the same stage is a no-op`, async () => {
    const s = await make();
    await s.add(j1);
    await s.move(j1.id, 'discovered');
    assert.equal((await s.events(j1.id)).length, 1);
  });

  test(`${name}: invalid stage and unknown job are rejected with typed errors`, async () => {
    const s = await make();
    await s.add(j1);
    await assert.rejects(() => s.move(j1.id, 'bogus' as never), (e: unknown) => e instanceof PipelineError && e.code === 'invalid_stage');
    await assert.rejects(() => s.move('nope', 'qualified'), (e: unknown) => e instanceof PipelineError && e.code === 'not_found');
    await assert.rejects(() => s.events('nope'), (e: unknown) => e instanceof PipelineError && e.code === 'not_found');
  });

  test(`${name}: seed history is imported when adopting an existing application`, async () => {
    const s = await make();
    const { application } = await s.add(j2, {
      seedHistory: [
        { stage: 'discovered', at: '2026-10-01' },
        { stage: 'qualified', at: '2026-10-02' },
        { stage: 'submitted', at: '2026-10-05', note: 'enviada' },
      ],
    });
    assert.equal(application.stage, 'submitted');
    assert.equal(application.events.length, 3);
    assert.deepEqual(application.events.map((e) => e.to), ['discovered', 'qualified', 'submitted']);
  });

  if (reopen) {
    test(`${name}: data survives a restart`, async () => {
      const s = await make();
      await s.add(j1);
      await s.move(j1.id, 'qualified');
      const s2 = await reopen(s);
      const list = await s2.list();
      assert.equal(list.length, 1);
      assert.equal(list[0]!.stage, 'qualified');
      assert.equal(list[0]!.events.length, 2);
    });
  }

  test(`${name}: concurrent moves do not lose events`, async () => {
    const s = await make();
    await s.add(j1);
    await s.add(j2);
    await Promise.all([s.move(j1.id, 'qualified'), s.move(j2.id, 'qualified'), s.move(j1.id, 'preparing')]);
    const e1 = await s.events(j1.id);
    const e2 = await s.events(j2.id);
    assert.equal(e2.length, 2);
    assert.ok(e1.length >= 2);
    assert.equal(e1[e1.length - 1]!.to, (await s.list()).find((a) => a.job.jobId === j1.id)!.stage);
  });
}
