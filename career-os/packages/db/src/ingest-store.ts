import { jobDedupeKey, type NormalizedJob } from '@career-os/core';
import { withUser, type Db } from './client.ts';

export interface IngestUpsertResult {
  inserted: number;
  updated: number;
  failed: { jobId: string; error: string }[];
}

/** Idempotent mirror of normalized jobs (career-ops → Supabase). Never deletes. */
export async function upsertIngestedJobs(db: Db, ownerId: string, items: NormalizedJob[]): Promise<IngestUpsertResult> {
  return withUser(db, ownerId, async (tx) => {
    let inserted = 0;
    let updated = 0;
    const failed: IngestUpsertResult['failed'] = [];
    const sourceIds = new Map<string, string>();
    for (const n of items) {
      const j = n.job;
      // per-row savepoint: one invalid row is reported, the rest of the batch still commits
      await tx.query('savepoint job_row');
      try {
      const srcName = j.source.name || 'career-ops';
      if (!sourceIds.has(srcName)) {
        const sr = await tx.query<{ id: string }>(
          `insert into public.job_sources (owner_id, kind, name) values (auth.uid(), $1, $2)
           on conflict (owner_id, name) do update set enabled = public.job_sources.enabled returning id`,
          [j.origin === 'demo' ? 'demo' : srcName === 'career-ops tracker' ? 'career-ops-tracker' : 'career-ops-scan', srcName],
        );
        sourceIds.set(srcName, sr.rows[0]!.id);
      }
      const r = await tx.query<{ inserted: boolean }>(
        `insert into public.jobs (owner_id, external_id, dedupe_key, url_key, origin, title, normalized_title, company, normalized_company,
                                 country, city, work_mode, seniority, area, description, requirements, salary, posted_at,
                                 discovered_at, verified_at, status, career_ops_score, quality_issues, raw, source_id)
         values (auth.uid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb, $17, $18, $19, $20, $21, $22, $23::jsonb, $24)
         on conflict (owner_id, dedupe_key) do update set
           verified_at = greatest(public.jobs.verified_at, excluded.verified_at),
           status = excluded.status,
           posted_at = coalesce(public.jobs.posted_at, excluded.posted_at),
           career_ops_score = coalesce(excluded.career_ops_score, public.jobs.career_ops_score),
           quality_issues = excluded.quality_issues
         returning (xmax = 0) as inserted`,
        [
          j.id, n.dedupeKey ?? jobDedupeKey(j), n.urlKey, j.origin, j.title, j.normalizedTitle, j.company, j.company.trim().toLowerCase(),
          /^[A-Z]{2}$/.test(j.country) ? j.country : null, j.city, j.workMode, j.seniority, j.area, j.description,
          JSON.stringify(j.requirements), j.salary ? JSON.stringify(j.salary) : null, j.postedAt, j.discoveredAt, j.verifiedAt,
          j.status, j.careerOpsScore, n.issues, JSON.stringify({ url: j.source.url, source: j.source.name }), sourceIds.get(srcName),
        ],
      );
      await tx.query('release savepoint job_row');
      if (r.rows[0]?.inserted) inserted++;
      else updated++;
      } catch (e) {
        await tx.query('rollback to savepoint job_row');
        sourceIds.clear(); // a source created inside the rolled-back savepoint no longer exists
        failed.push({ jobId: j.id, error: (e as Error).message.slice(0, 200) });
      }
    }
    return { inserted, updated, failed };
  });
}

export async function recordAutomationRun(
  db: Db,
  ownerId: string,
  run: { kind: 'scan' | 'ingest' | 'liveness' | 'matching' | 'report' | 'sync' | 'diagnostic'; status: 'ok' | 'partial' | 'failed'; startedAt: string; finishedAt: string; summary: string; stats?: unknown; errors?: unknown[] },
): Promise<string> {
  return withUser(db, ownerId, async (tx) => {
    const r = await tx.query<{ id: string }>(
      `insert into public.automation_runs (owner_id, kind, status, started_at, finished_at, summary, stats, errors)
       values (auth.uid(), $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb) returning id`,
      [run.kind, run.status, run.startedAt, run.finishedAt, run.summary, JSON.stringify(run.stats ?? {}), JSON.stringify(run.errors ?? [])],
    );
    return r.rows[0]!.id;
  });
}
