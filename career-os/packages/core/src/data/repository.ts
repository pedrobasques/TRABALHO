import type { Application, Dataset, PipelineStage } from '../domain/types.ts';

/**
 * Persistence contract. Today: DemoRepository (in-memory) and the read-only
 * career-ops file adapter. Future (Phase 6): a database-backed implementation
 * (e.g. Postgres/Supabase) that stays a *derived* index of career-ops files
 * plus Career OS-only data (match scores, consents, provenance) — ADR-002.
 */
export interface DatasetRepository {
  readonly kind: 'demo' | 'career-ops' | 'database';
  load(): Promise<Dataset>;
}

export interface ApplicationWriter {
  /** Must go through career-ops' set-status.mjs for career-ops data. Not implemented yet. */
  moveStage(applicationId: string, stage: PipelineStage, at: string): Promise<Application>;
}
