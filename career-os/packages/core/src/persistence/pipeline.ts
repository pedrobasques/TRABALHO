/**
 * Pipeline persistence contract (ADR-007).
 *
 * One application per job (dedupe by job identity), an append-only event log
 * per application, and three implementations:
 *   - InMemoryPipelineStore  (tests / reference semantics)
 *   - FilePipelineStore      (local durable JSON, ./file-store.ts — server only)
 *   - PostgresPipelineStore  (Supabase, @career-os/db — RLS enforced)
 * All three must pass the same contract test suite (tests/pipeline-contract.ts).
 */
import { STAGE_ORDER, type Application, type DataOrigin, type Job, type PipelineStage, type StageEvent } from '../domain/types.ts';
import { jobDedupeKey } from '../ingest/normalize.ts';

export const ALL_STAGES: readonly PipelineStage[] = [...STAGE_ORDER, 'closed'];

export function isStage(v: unknown): v is PipelineStage {
  return typeof v === 'string' && (ALL_STAGES as readonly string[]).includes(v);
}

export interface PipelineEvent {
  id: string;
  from: PipelineStage | null;
  to: PipelineStage;
  at: string;
  note: string | null;
  actor: string;
}

/** Minimal job snapshot stored with the application (the job itself stays in its source). */
export interface JobSnapshot {
  jobId: string;
  dedupeKey: string;
  title: string;
  company: string;
  country: string;
  url: string | null;
  origin: DataOrigin;
}

export interface StoredApplication {
  id: string;
  job: JobSnapshot;
  origin: DataOrigin;
  stage: PipelineStage;
  closedReason: Application['closedReason'] | null;
  nextAction: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  events: PipelineEvent[];
}

export type PipelineErrorCode = 'not_found' | 'invalid_stage' | 'invalid_input' | 'unavailable' | 'conflict';

export class PipelineError extends Error {
  readonly code: PipelineErrorCode;
  constructor(code: PipelineErrorCode, message: string) {
    super(message);
    this.name = 'PipelineError';
    this.code = code;
  }
}

export interface AddOptions {
  /** History to import when adopting an application that already exists in the data source (e.g. career-ops tracker). */
  seedHistory?: StageEvent[];
  note?: string;
  actor?: string;
}

export interface PipelineStore {
  readonly kind: 'memory' | 'file' | 'postgres';
  /** Human-readable location (path or "postgres"), never credentials. */
  readonly location: string;
  list(): Promise<StoredApplication[]>;
  /** Idempotent: returns the existing application (created=false) when the job is already in the pipeline. */
  add(job: Job, opts?: AddOptions): Promise<{ application: StoredApplication; created: boolean }>;
  move(jobId: string, to: PipelineStage, note?: string, actor?: string): Promise<StoredApplication>;
  events(jobId: string): Promise<PipelineEvent[]>;
}

export function snapshotOf(job: Job): JobSnapshot {
  return {
    jobId: job.id,
    dedupeKey: jobDedupeKey(job),
    title: job.title,
    company: job.company,
    country: job.country,
    url: job.source.url,
    origin: job.origin,
  };
}

export function validateJob(job: Job): void {
  if (!job || typeof job.id !== 'string' || !job.id) throw new PipelineError('invalid_input', 'job.id is required');
  if (!job.title?.trim()) throw new PipelineError('invalid_input', 'job.title is required');
}

/** Converts stored history into the dashboard's Application shape. */
export function toApplication(s: StoredApplication): Application {
  const app: Application = {
    id: s.id,
    origin: s.origin,
    jobId: s.job.jobId,
    stage: s.stage,
    history: s.events.map((e) => ({ stage: e.to, at: e.at, ...(e.note ? { note: e.note } : {}) })),
    nextAction: s.nextAction,
    nextActionDue: null,
    notes: s.notes,
  };
  if (s.closedReason) app.closedReason = s.closedReason;
  return app;
}

/* ------------------------------------------------------------- in-memory */

let seq = 0;
const newId = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Shared semantics used by the memory and file stores. Pure over a mutable state object. */
export class PipelineState {
  apps: StoredApplication[] = [];

  find(jobId: string): StoredApplication | undefined {
    return this.apps.find((a) => a.job.jobId === jobId);
  }

  add(job: Job, opts: AddOptions = {}, now = new Date().toISOString()): { application: StoredApplication; created: boolean } {
    validateJob(job);
    const snap = snapshotOf(job);
    const existing = this.apps.find((a) => a.job.jobId === job.id || a.job.dedupeKey === snap.dedupeKey);
    if (existing) return { application: existing, created: false };
    const actor = opts.actor ?? 'dashboard';
    const seed = (opts.seedHistory ?? []).filter((e) => isStage(e.stage));
    const events: PipelineEvent[] = seed.length
      ? seed.map((e, i) => ({ id: newId('evt'), from: i === 0 ? null : seed[i - 1]!.stage, to: e.stage, at: e.at, note: e.note ?? null, actor: 'import' }))
      : [{ id: newId('evt'), from: null, to: 'discovered', at: now, note: opts.note ?? null, actor }];
    const app: StoredApplication = {
      id: newId('app'),
      job: snap,
      origin: job.origin,
      stage: events[events.length - 1]!.to,
      closedReason: null,
      nextAction: null,
      notes: '',
      createdAt: now,
      updatedAt: now,
      events,
    };
    this.apps.push(app);
    return { application: app, created: true };
  }

  move(jobId: string, to: PipelineStage, note?: string, actor = 'dashboard', now = new Date().toISOString()): StoredApplication {
    if (!isStage(to)) throw new PipelineError('invalid_stage', `invalid stage "${String(to)}"`);
    const app = this.find(jobId);
    if (!app) throw new PipelineError('not_found', `job ${jobId} is not in the pipeline`);
    if (app.stage === to) return app;
    app.events.push({ id: newId('evt'), from: app.stage, to, at: now, note: note ?? null, actor });
    app.stage = to;
    app.updatedAt = now;
    return app;
  }

  events(jobId: string): PipelineEvent[] {
    const app = this.find(jobId);
    if (!app) throw new PipelineError('not_found', `job ${jobId} is not in the pipeline`);
    return [...app.events];
  }
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export class InMemoryPipelineStore implements PipelineStore {
  readonly kind = 'memory' as const;
  readonly location = 'memory';
  private state = new PipelineState();
  async list() {
    return clone(this.state.apps);
  }
  async add(job: Job, opts?: AddOptions) {
    return clone(this.state.add(job, opts));
  }
  async move(jobId: string, to: PipelineStage, note?: string, actor?: string) {
    return clone(this.state.move(jobId, to, note, actor));
  }
  async events(jobId: string) {
    return clone(this.state.events(jobId));
  }
}
