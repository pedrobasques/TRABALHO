import {
  PipelineError,
  isStage,
  jobDedupeKey,
  urlKey,
  type AddOptions,
  type Job,
  type PipelineEvent,
  type PendingEvent,
  type SyncState,
  type PipelineStage,
  type PipelineStore,
  type StoredApplication,
} from '@career-os/core';
import { setEventContext, withUser, type Db, type Tx } from './client.ts';

/** Map driver errors to typed pipeline errors; never leak connection strings. */
function wrap(e: unknown): never {
  if (e instanceof PipelineError) throw e;
  const err = e as { code?: string; message?: string };
  if (err.code === '42501') throw new PipelineError('conflict', 'access denied by row level security');
  if (err.code === '23505') throw new PipelineError('conflict', 'duplicate record');
  if (err.code === '23514' || err.code === '22P02') throw new PipelineError('invalid_input', err.message ?? 'invalid input');
  throw new PipelineError('unavailable', `database unavailable (${err.code ?? 'no code'})`);
}

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d));

interface AppRow {
  id: string;
  origin: StoredApplication['origin'];
  stage: PipelineStage;
  closed_reason: StoredApplication['closedReason'];
  next_action: string | null;
  notes: string;
  created_at: Date;
  updated_at: Date;
  job_external_id: string | null;
  job_id: string;
  dedupe_key: string;
  title: string;
  company: string;
  country: string | null;
  url: string | null;
  job_origin: StoredApplication['origin'];
}

const APP_SELECT = `
  select a.id, a.origin, a.stage, a.closed_reason, a.next_action, a.notes, a.created_at, a.updated_at,
         j.external_id as job_external_id, j.id as job_id, j.dedupe_key, j.title, j.company, j.country,
         j.raw->>'url' as url, j.origin as job_origin
    from public.applications a join public.jobs j on j.id = a.job_id`;

export class PostgresPipelineStore implements PipelineStore {
  readonly kind = 'postgres' as const;
  readonly location = 'postgres';

  private readonly db: Db;
  readonly ownerId: string;

  constructor(db: Db, ownerId: string) {
    this.db = db;
    this.ownerId = ownerId;
  }

  private async eventsFor(tx: Tx, appIds: string[]): Promise<Map<string, PipelineEvent[]>> {
    const m = new Map<string, PipelineEvent[]>();
    if (!appIds.length) return m;
    const r = await tx.query<{ id: string; application_id: string; from_stage: PipelineStage | null; to_stage: PipelineStage; note: string | null; actor: string; occurred_at: Date; sync_state: SyncState | null; sync_detail: string | null; sync_at: Date | null }>(
      `select e.id::text, e.application_id, e.from_stage, e.to_stage, e.note, e.actor, e.occurred_at,
              s.state as sync_state, s.detail as sync_detail, s.updated_at as sync_at
         from public.application_events e left join public.event_sync s on s.event_id = e.id
        where e.application_id = any($1::uuid[]) order by e.occurred_at, e.id`,
      [appIds],
    );
    for (const e of r.rows) {
      const list = m.get(e.application_id) ?? [];
      list.push({
        id: e.id, from: e.from_stage, to: e.to_stage, at: iso(e.occurred_at), note: e.note, actor: e.actor,
        sync: { state: e.sync_state ?? 'pending', at: e.sync_at ? iso(e.sync_at) : null, detail: e.sync_detail },
      });
      m.set(e.application_id, list);
    }
    return m;
  }

  private toStored(r: AppRow, events: PipelineEvent[]): StoredApplication {
    return {
      id: r.id,
      job: { jobId: r.job_external_id ?? r.job_id, dedupeKey: r.dedupe_key, title: r.title, company: r.company, country: r.country ?? '??', url: r.url, origin: r.job_origin },
      origin: r.origin,
      stage: r.stage,
      closedReason: r.closed_reason,
      nextAction: r.next_action,
      notes: r.notes,
      createdAt: iso(r.created_at),
      updatedAt: iso(r.updated_at),
      events,
    };
  }

  private async findByJob(tx: Tx, jobId: string, lock = false): Promise<AppRow | null> {
    const r = await tx.query<AppRow>(`${APP_SELECT} where j.external_id = $1 ${lock ? 'for update of a' : ''}`, [jobId]);
    return r.rows[0] ?? null;
  }

  async list(): Promise<StoredApplication[]> {
    try {
      return await withUser(this.db, this.ownerId, async (tx) => {
        const r = await tx.query<AppRow>(`${APP_SELECT} order by a.created_at`);
        const ev = await this.eventsFor(tx, r.rows.map((x) => x.id));
        return r.rows.map((row) => this.toStored(row, ev.get(row.id) ?? []));
      });
    } catch (e) {
      wrap(e);
    }
  }

  /**
   * Resolves the job row: same native id, or the same identity AND the same (or absent) posting URL.
   * Two postings with the same identity but different URLs are distinct requisitions → distinct rows.
   */
  private async upsertJob(tx: Tx, job: Job): Promise<string> {
    const found = await tx.query<{ id: string }>(
      `select id from public.jobs where external_id = $1 or (dedupe_key = $2 and url_key is not distinct from $3) order by (external_id = $1) desc limit 1`,
      [job.id, jobDedupeKey(job), urlKey(job.source.url)],
    );
    if (found.rows[0]) return found.rows[0].id;
    const country = /^[A-Z]{2}$/.test(job.country) ? job.country : null;
    const r = await tx.query<{ id: string }>(
      `insert into public.jobs (owner_id, external_id, dedupe_key, url_key, origin, title, normalized_title, company, normalized_company,
                               country, city, work_mode, seniority, area, description, requirements, salary, posted_at,
                               discovered_at, verified_at, status, career_ops_score, raw)
       values (auth.uid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb, $17, $18, $19, $20, $21, $22::jsonb)
       on conflict (owner_id, external_id) do update
         set verified_at = greatest(public.jobs.verified_at, excluded.verified_at),
             status = excluded.status
       returning id`,
      [
        job.id, jobDedupeKey(job), urlKey(job.source.url), job.origin, job.title, job.normalizedTitle, job.company,
        job.company.trim().toLowerCase(), country, job.city, job.workMode, job.seniority, job.area, job.description,
        JSON.stringify(job.requirements), job.salary ? JSON.stringify(job.salary) : null, job.postedAt,
        job.discoveredAt, job.verifiedAt, job.status, job.careerOpsScore, JSON.stringify({ url: job.source.url, source: job.source.name }),
      ],
    );
    return r.rows[0]!.id;
  }

  async add(job: Job, opts: AddOptions = {}): Promise<{ application: StoredApplication; created: boolean }> {
    if (!job?.id || !job.title?.trim()) throw new PipelineError('invalid_input', 'job.id and job.title are required');
    try {
      return await withUser(this.db, this.ownerId, async (tx) => {
        const jobRow = await this.upsertJob(tx, job);
        const existing = await tx.query<{ id: string }>(`select id from public.applications where job_id = $1`, [jobRow]);
        if (existing.rows[0]) {
          const row = (await tx.query<AppRow>(`${APP_SELECT} where a.id = $1`, [existing.rows[0].id])).rows[0]!;
          const ev = await this.eventsFor(tx, [row.id]);
          return { application: this.toStored(row, ev.get(row.id) ?? []), created: false };
        }
        const seed = (opts.seedHistory ?? []).filter((e) => isStage(e.stage));
        const first = seed[0] ?? { stage: 'discovered' as PipelineStage, at: null, note: opts.note };
        await setEventContext(tx, { note: first.note ?? null, actor: seed.length ? 'import' : (opts.actor ?? 'dashboard'), at: first.at ?? null });
        const ins = await tx.query<{ id: string }>(
          `insert into public.applications (owner_id, job_id, origin, stage) values (auth.uid(), $1, $2, $3) returning id`,
          [jobRow, job.origin, first.stage],
        );
        const appId = ins.rows[0]!.id;
        for (const e of seed.slice(1)) {
          await setEventContext(tx, { note: e.note ?? null, actor: 'import', at: e.at });
          await tx.query(`update public.applications set stage = $2 where id = $1`, [appId, e.stage]);
        }
        const row = (await tx.query<AppRow>(`${APP_SELECT} where a.id = $1`, [appId])).rows[0]!;
        const ev = await this.eventsFor(tx, [appId]);
        return { application: this.toStored(row, ev.get(appId) ?? []), created: true };
      });
    } catch (e) {
      wrap(e);
    }
  }

  async move(jobId: string, to: PipelineStage, note?: string, actor = 'dashboard'): Promise<StoredApplication> {
    if (!isStage(to)) throw new PipelineError('invalid_stage', `invalid stage "${String(to)}"`);
    try {
      return await withUser(this.db, this.ownerId, async (tx) => {
        const row = await this.findByJob(tx, jobId, true);
        if (!row) throw new PipelineError('not_found', `job ${jobId} is not in the pipeline`);
        if (row.stage !== to) {
          await setEventContext(tx, { note: note ?? null, actor });
          await tx.query(`update public.applications set stage = $2 where id = $1`, [row.id, to]);
        }
        const fresh = (await tx.query<AppRow>(`${APP_SELECT} where a.id = $1`, [row.id])).rows[0]!;
        const ev = await this.eventsFor(tx, [row.id]);
        return this.toStored(fresh, ev.get(row.id) ?? []);
      });
    } catch (e) {
      wrap(e);
    }
  }

  async pendingSync(): Promise<PendingEvent[]> {
    const apps = await this.list();
    const out: PendingEvent[] = [];
    for (const application of apps)
      for (const event of application.events) if (event.sync?.state === 'pending' || event.sync?.state === 'failed') out.push({ application, event });
    return out.sort((a, b) => a.event.at.localeCompare(b.event.at));
  }

  async markSync(eventId: string, state: Exclude<SyncState, 'pending'>, detail: string | null = null): Promise<void> {
    if (!/^\d+$/.test(eventId)) throw new PipelineError('invalid_input', 'event id must be numeric');
    try {
      await withUser(this.db, this.ownerId, (tx) =>
        tx.query(
          `insert into public.event_sync (event_id, owner_id, state, detail) values ($1, auth.uid(), $2, $3)
           on conflict (event_id) do update set state = excluded.state, detail = excluded.detail, updated_at = now()`,
          [eventId, state, detail],
        ),
      );
    } catch (e) {
      wrap(e);
    }
  }

  async events(jobId: string): Promise<PipelineEvent[]> {
    try {
      return await withUser(this.db, this.ownerId, async (tx) => {
        const row = await this.findByJob(tx, jobId);
        if (!row) throw new PipelineError('not_found', `job ${jobId} is not in the pipeline`);
        return (await this.eventsFor(tx, [row.id])).get(row.id) ?? [];
      });
    } catch (e) {
      wrap(e);
    }
  }
}
