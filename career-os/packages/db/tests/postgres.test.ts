/**
 * Integration tests against a REAL PostgreSQL (TEST_DATABASE_URL, superuser — e.g. the local cluster
 * described in docs/PERSISTENCE.md). Creates a throwaway database, applies the Supabase shim + migrations,
 * runs the shared PipelineStore contract and Row Level Security checks. Skipped (not faked) when no
 * database is configured.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { runPipelineContract } from '@career-os/core/tests/pipeline-contract';
import { buildDemoJobs, dedupeJobs, normalizeJob } from '@career-os/core';
import { PostgresPipelineStore, createDb, loadJobs, loadProfileSnapshot, recordAutomationRun, runMigrations, upsertIngestedJobs, upsertProfileSnapshot, withUser, type Db } from '../src/index.ts';
import { DEMO_PROFILE, PipelineError } from '@career-os/core';

const ADMIN_URL = process.env.TEST_DATABASE_URL;
const here = dirname(fileURLToPath(import.meta.url));
const SUPABASE_DIR = join(here, '..', '..', '..', 'supabase');

if (!ADMIN_URL) {
  test('postgres integration (skipped: TEST_DATABASE_URL not set)', { skip: 'set TEST_DATABASE_URL to a superuser connection string' }, () => {});
} else {
  const dbName = `cos_test_${Date.now()}`;
  let db: Db;
  let testUrl = '';
  const extraPools: Db[] = [];
  let admin: pg.Client;

  const newOwner = async (): Promise<string> => {
    const id = randomUUID();
    await admin.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${id}@test.local`]);
    await admin.query(`insert into public.app_users (id, email) values ($1, $2)`, [id, `${id}@test.local`]);
    return id;
  };

  before(async () => {
    const root = new pg.Client({ connectionString: ADMIN_URL });
    await root.connect();
    await root.query(`create database ${dbName}`);
    await root.end();
    const url = new URL(ADMIN_URL);
    url.pathname = `/${dbName}`;
    admin = new pg.Client({ connectionString: url.toString() });
    await admin.connect();
    await admin.query(readFileSync(join(SUPABASE_DIR, 'tests', 'supabase-shim.sql'), 'utf8'));
    const res = await runMigrations(admin, join(SUPABASE_DIR, 'migrations'));
    assert.ok(res.applied.length >= 2);
    testUrl = url.toString();
    db = createDb({ connectionString: testUrl, max: 4 });
  });

  after(async () => {
    await Promise.all(extraPools.map((p) => p.end()));
    await db?.end();
    await admin?.end();
    const root = new pg.Client({ connectionString: ADMIN_URL });
    await root.connect();
    await root.query(`drop database if exists ${dbName} with (force)`);
    await root.end();
  });

  // Each contract test gets a brand-new owner: RLS alone must isolate them.
  runPipelineContract(
    'postgres',
    async () => new PostgresPipelineStore(db, await newOwner()),
    // "restart": a brand-new pool (new connections) reading the same owner's data
    async (s) => {
      const pool = createDb({ connectionString: testUrl });
      extraPools.push(pool);
      return new PostgresPipelineStore(pool, (s as PostgresPipelineStore).ownerId);
    },
  );

  describe('row level security', () => {
    test('owners cannot see each other’s applications', async () => {
      const [a, b] = [await newOwner(), await newOwner()];
      const job = buildDemoJobs()[3]!;
      await new PostgresPipelineStore(db, a).add(job);
      assert.equal((await new PostgresPipelineStore(db, a).list()).length, 1);
      assert.equal((await new PostgresPipelineStore(db, b).list()).length, 0);
      await assert.rejects(() => new PostgresPipelineStore(db, b).move(job.id, 'qualified'), /not in the pipeline/);
    });

    test('authenticated users cannot write or alter history directly', async () => {
      const a = await newOwner();
      const job = buildDemoJobs()[4]!;
      const { application } = await new PostgresPipelineStore(db, a).add(job);
      await assert.rejects(
        () => withUser(db, a, (tx) => tx.query(`insert into public.application_events (owner_id, application_id, to_stage) values (auth.uid(), $1, 'offer')`, [application.id])),
        /permission denied/,
      );
      await assert.rejects(() => withUser(db, a, (tx) => tx.query(`update public.application_events set to_stage = 'offer'`)), /permission denied/);
      await assert.rejects(() => withUser(db, a, (tx) => tx.query(`delete from public.application_events`)), /permission denied/);
    });

    test('cannot insert rows for another owner', async () => {
      const [a, b] = [await newOwner(), await newOwner()];
      await assert.rejects(
        () => withUser(db, a, (tx) => tx.query(`insert into public.job_sources (owner_id, kind, name) values ($1, 'manual', 'x')`, [b])),
        /row-level security/,
      );
    });

    test('anon role has no access at all', async () => {
      const c = await db.connect();
      try {
        await c.query('begin');
        await c.query('set local role anon');
        await assert.rejects(() => c.query('select * from public.jobs'), /permission denied/);
      } finally {
        await c.query('rollback');
        c.release();
      }
    });

    test('an application cannot point at another owner’s job (trigger + RLS)', async () => {
      const [a, b] = [await newOwner(), await newOwner()];
      await new PostgresPipelineStore(db, a).add(buildDemoJobs()[5]!);
      const jobOfA = (await admin.query<{ id: string }>(`select id from public.jobs where owner_id = $1`, [a])).rows[0]!.id;
      await assert.rejects(() => withUser(db, b, (tx) => tx.query(`insert into public.applications (owner_id, job_id, origin, stage) values (auth.uid(), $1, 'manual', 'discovered')`, [jobOfA])), /does not belong|row-level security/);
    });

    test('another owner cannot mark my events as synced', async () => {
      const [a, b] = [await newOwner(), await newOwner()];
      const job = buildDemoJobs()[7]!;
      const s = new PostgresPipelineStore(db, a);
      await s.add(job);
      await s.move(job.id, 'submitted');
      const ev = (await s.pendingSync()).at(-1)!.event;
      await assert.rejects(() => new PostgresPipelineStore(db, b).markSync(ev.id, 'applied', 'hijack'), (e: unknown) => e instanceof PipelineError);
      assert.equal((await s.pendingSync()).length, 2, 'still pending for the owner');
    });

    test('database unavailable → typed "unavailable" error, never a silent success', async () => {
      const dead = createDb({ connectionString: 'postgres://postgres@127.0.0.1:1/none' });
      extraPools.push(dead);
      const s = new PostgresPipelineStore(dead, await newOwner());
      await assert.rejects(() => s.list(), (e: unknown) => e instanceof PipelineError && e.code === 'unavailable');
      await assert.rejects(() => s.add(buildDemoJobs()[0]!), (e: unknown) => e instanceof PipelineError && e.code === 'unavailable');
      await assert.rejects(() => s.move('d01', 'qualified'), (e: unknown) => e instanceof PipelineError && e.code === 'unavailable');
    });

    test('every stage change is captured in history with dates and audit log', async () => {
      const a = await newOwner();
      const s = new PostgresPipelineStore(db, a);
      const job = buildDemoJobs()[6]!;
      await s.add(job, { seedHistory: [{ stage: 'discovered', at: '2026-10-01T00:00:00Z' }, { stage: 'qualified', at: '2026-10-03T00:00:00Z' }] });
      await s.move(job.id, 'preparing', 'cv adaptado');
      const ev = await s.events(job.id);
      assert.deepEqual(ev.map((e) => e.to), ['discovered', 'qualified', 'preparing']);
      assert.equal(ev[0]!.at.slice(0, 10), '2026-10-01', 'imported history keeps its original dates');
      assert.equal(ev[2]!.note, 'cv adaptado');
      const audit = await admin.query(`select op from public.audit_log where owner_id = $1 and table_name = 'applications' order by id`, [a]);
      assert.ok(audit.rows.length >= 3);
    });
  });

  describe('ingest mirror', () => {
    test('upsert is idempotent and dedupes by identity', async () => {
      const a = await newOwner();
      const jobs = buildDemoJobs().slice(0, 5).map((j) => normalizeJob({ ...j, origin: 'career-ops' }));
      const first = await upsertIngestedJobs(db, a, jobs);
      assert.deepEqual(first, { inserted: 5, updated: 0, failed: [] });
      const again = await upsertIngestedJobs(db, a, dedupeJobs([...jobs, ...jobs]).jobs);
      assert.deepEqual(again, { inserted: 0, updated: 5, failed: [] });
      const n = await admin.query(`select count(*)::int as n from public.jobs where owner_id = $1`, [a]);
      assert.equal(n.rows[0].n, 5);
    });

    test('partial failure: an invalid row is reported and the rest of the batch commits', async () => {
      const a = await newOwner();
      const jobs = buildDemoJobs().slice(10, 14).map((j) => normalizeJob({ ...j, origin: 'career-ops' }));
      const bad = { ...jobs[1]!, job: { ...jobs[1]!.job, workMode: 'teleport' as never } };
      const r = await upsertIngestedJobs(db, a, [jobs[0]!, bad, jobs[2]!, jobs[3]!]);
      assert.equal(r.inserted, 3);
      assert.equal(r.failed.length, 1);
      assert.equal(r.failed[0]!.jobId, bad.job.id);
      assert.match(r.failed[0]!.error, /check constraint/);
      const loaded = await loadJobs(db, a);
      assert.equal(loaded.length, 3);
      assert.ok(loaded.every((j) => j.source.name), 'source recorded');
    });

    test('profile snapshot round-trips and is owner-scoped; normalized rows written', async () => {
      const [a, b] = [await newOwner(), await newOwner()];
      const profile = { ...DEMO_PROFILE, origin: 'career-ops' as const, importReport: { unknowns: ['x'], notes: [], sources: ['cv.md'] } };
      const { hash } = await upsertProfileSnapshot(db, a, profile);
      await upsertProfileSnapshot(db, a, profile); // idempotent replace
      assert.deepEqual(await loadProfileSnapshot(db, a), profile);
      assert.equal(await loadProfileSnapshot(db, b), null);
      const n = await admin.query(`select (select count(*) from public.skills where owner_id=$1)::int s, (select count(*) from public.experiences where owner_id=$1)::int e`, [a]);
      assert.equal(n.rows[0].s, profile.skills.length);
      assert.equal(n.rows[0].e, profile.experience.length);
      assert.equal(hash.length, 16);
    });

    test('automation runs are recorded and constraint-checked', async () => {
      const a = await newOwner();
      const id = await recordAutomationRun(db, a, { kind: 'ingest', status: 'ok', startedAt: '2026-11-05T10:00:00Z', finishedAt: '2026-11-05T10:00:02Z', summary: 'test', stats: { jobs: 3 } });
      assert.match(id, /^[0-9a-f-]{36}$/);
      await assert.rejects(() => recordAutomationRun(db, a, { kind: 'ingest', status: 'ok', startedAt: '2026-11-05T10:00:00Z', finishedAt: '2026-11-05T09:00:00Z', summary: 'bad' }), /check constraint/);
    });
  });
}
