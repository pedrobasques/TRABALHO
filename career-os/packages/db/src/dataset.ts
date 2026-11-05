/**
 * Database-backed dataset for deployments without career-ops files (Vercel).
 * Jobs come from the ingest mirror; the profile from the snapshot written by
 * `npm run radar -- --db`. Applications come from the PipelineStore separately.
 */
import { createHash } from 'node:crypto';
import type { CandidateProfile, Job, JobArea, Seniority, WorkMode } from '@career-os/core';
import { withUser, type Db } from './client.ts';

interface JobRow {
  external_id: string | null;
  id: string;
  origin: Job['origin'];
  title: string;
  normalized_title: string;
  company: string;
  country: string | null;
  city: string | null;
  work_mode: WorkMode;
  seniority: Seniority;
  area: JobArea;
  description: string;
  requirements: Job['requirements'];
  salary: Job['salary'];
  posted_at: Date | null;
  discovered_at: Date;
  verified_at: Date | null;
  status: Job['status'];
  career_ops_score: string | null;
  quality_issues: string[];
  raw: { url?: string | null; source?: string } | null;
  source_name: string | null;
}

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function loadJobs(db: Db, ownerId: string, limit = 2000): Promise<Job[]> {
  return withUser(db, ownerId, async (tx) => {
    const r = await tx.query<JobRow>(
      `select j.external_id, j.id, j.origin, j.title, j.normalized_title, j.company, j.country, j.city, j.work_mode, j.seniority, j.area,
              j.description, j.requirements, j.salary, j.posted_at, j.discovered_at, j.verified_at, j.status, j.career_ops_score::text,
              j.quality_issues, j.raw, s.name as source_name
         from public.jobs j left join public.job_sources s on s.id = j.source_id
        order by j.discovered_at desc limit $1`,
      [limit],
    );
    return r.rows.map(
      (x): Job => ({
        id: x.external_id ?? x.id,
        origin: x.origin,
        title: x.title,
        normalizedTitle: x.normalized_title,
        company: x.company,
        sector: '—',
        area: x.area,
        country: x.country ?? '??',
        city: x.city,
        workMode: x.work_mode,
        seniority: x.seniority,
        description: x.description,
        requirements: x.requirements ?? [],
        salary: x.salary,
        postedAt: day(x.posted_at),
        discoveredAt: x.discovered_at.toISOString().slice(0, 10),
        verifiedAt: day(x.verified_at),
        status: x.status,
        source: { name: x.source_name ?? x.raw?.source ?? 'career-ops', url: x.raw?.url ?? null },
        careerOpsScore: x.career_ops_score == null ? null : Number(x.career_ops_score),
        visaSponsorship: 'unknown',
        qualityIssues: x.quality_issues,
      }),
    );
  });
}

export function profileHash(p: CandidateProfile): string {
  return createHash('sha256').update(JSON.stringify(p)).digest('hex').slice(0, 16);
}

/** Upserts the profile snapshot and its normalized skills/experiences rows (replace-all, one transaction). */
export async function upsertProfileSnapshot(db: Db, ownerId: string, profile: CandidateProfile): Promise<{ profileId: string; hash: string }> {
  const hash = profileHash(profile);
  return withUser(db, ownerId, async (tx) => {
    const r = await tx.query<{ id: string }>(
      `insert into public.professional_profiles (owner_id, headline, summary, years_experience, current_seniority, target_seniority, preferences, eligibility, source, source_ref, snapshot, snapshot_hash)
       values (auth.uid(), $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, 'career-ops', $8, $9::jsonb, $10)
       on conflict (owner_id) do update set headline = excluded.headline, summary = excluded.summary, years_experience = excluded.years_experience,
         current_seniority = excluded.current_seniority, target_seniority = excluded.target_seniority, preferences = excluded.preferences,
         eligibility = excluded.eligibility, source_ref = excluded.source_ref, snapshot = excluded.snapshot, snapshot_hash = excluded.snapshot_hash
       returning id`,
      [
        profile.headline, profile.summary, profile.yearsExperience, profile.currentSeniority, profile.targetSeniority,
        JSON.stringify(profile.preferences), JSON.stringify(profile.eligibility), (profile.importReport?.sources ?? []).join(', '),
        JSON.stringify(profile), hash,
      ],
    );
    const profileId = r.rows[0]!.id;
    await tx.query(`delete from public.skills where profile_id = $1`, [profileId]);
    await tx.query(`delete from public.experiences where profile_id = $1`, [profileId]);
    for (const s of profile.skills) {
      await tx.query(`insert into public.skills (owner_id, profile_id, key, label, level, provenance) values (auth.uid(), $1, $2, $3, $4, $5) on conflict (profile_id, key) do nothing`, [
        profileId, s.key, s.label, s.level, s.provenance,
      ]);
    }
    for (const e of profile.experience) {
      await tx.query(`insert into public.experiences (owner_id, profile_id, company, role, start_date, end_date, summary, provenance) values (auth.uid(), $1, $2, $3, $4, $5, $6, $7)`, [
        profileId, e.company || '—', e.role || '—', e.start || null, e.end, e.summary, e.provenance,
      ]);
    }
    return { profileId, hash };
  });
}

export async function loadProfileSnapshot(db: Db, ownerId: string): Promise<CandidateProfile | null> {
  return withUser(db, ownerId, async (tx) => {
    const r = await tx.query<{ snapshot: CandidateProfile | null }>(`select snapshot from public.professional_profiles limit 1`);
    return r.rows[0]?.snapshot ?? null;
  });
}
