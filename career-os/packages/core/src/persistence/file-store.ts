/**
 * Durable local pipeline store: one JSON file, written atomically (temp file +
 * rename) and serialized through an in-process queue. Survives restarts.
 * Server-only (node:fs). Not suitable for serverless (read-only / ephemeral FS).
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Job, PipelineStage } from '../domain/types.ts';
import { PipelineError, PipelineState, type AddOptions, type PipelineStore, type StoredApplication, type SyncState } from './pipeline.ts';

interface FileShape {
  version: 1;
  applications: StoredApplication[];
}

export class FilePipelineStore implements PipelineStore {
  readonly kind = 'file' as const;
  readonly location: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(path: string) {
    this.location = path;
  }

  private load(): PipelineState {
    const st = new PipelineState();
    if (!existsSync(this.location)) return st;
    let parsed: FileShape;
    try {
      parsed = JSON.parse(readFileSync(this.location, 'utf8')) as FileShape;
    } catch (e) {
      throw new PipelineError('unavailable', `pipeline file is unreadable or corrupt: ${(e as Error).message}`);
    }
    if (parsed.version !== 1 || !Array.isArray(parsed.applications)) throw new PipelineError('unavailable', 'unsupported pipeline file format');
    st.apps = parsed.applications;
    return st;
  }

  private save(st: PipelineState): void {
    try {
      mkdirSync(dirname(this.location), { recursive: true });
      const tmp = `${this.location}.${process.pid}.tmp`;
      const body: FileShape = { version: 1, applications: st.apps };
      writeFileSync(tmp, JSON.stringify(body, null, 2), { encoding: 'utf8', mode: 0o600 });
      renameSync(tmp, this.location);
    } catch (e) {
      throw new PipelineError('unavailable', `cannot write pipeline file: ${(e as Error).message}`);
    }
  }

  /** Serialize read-modify-write cycles so concurrent requests cannot lose updates. */
  private run<T>(fn: () => T): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  list() {
    return this.run(() => this.load().apps);
  }

  add(job: Job, opts?: AddOptions) {
    return this.run(() => {
      const st = this.load();
      const r = st.add(job, opts);
      if (r.created) this.save(st);
      return r;
    });
  }

  move(jobId: string, to: PipelineStage, note?: string, actor?: string) {
    return this.run(() => {
      const st = this.load();
      const before = st.find(jobId)?.stage;
      const app = st.move(jobId, to, note, actor);
      if (before !== app.stage) this.save(st);
      return app;
    });
  }

  events(jobId: string) {
    return this.run(() => this.load().events(jobId));
  }

  pendingSync() {
    return this.run(() => this.load().pendingSync());
  }

  markSync(eventId: string, state: Exclude<SyncState, 'pending'>, detail?: string | null) {
    return this.run(() => {
      const st = this.load();
      st.markSync(eventId, state, detail ?? null);
      this.save(st);
    });
  }
}
