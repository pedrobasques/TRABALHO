/**
 * Two-way reconciliation between the Career OS journal (PipelineStore) and the
 * canonical career-ops tracker (ADR-008). Server-only (spawns node).
 *
 *  push: every pending/failed dashboard event → `set-status.mjs --row N <State> --on DATE --source web`
 *        (career-ops' own locked, validated, atomic writer; also appends status-log.tsv).
 *  pull: tracker rows whose status differs from the journal (changed by career-ops itself)
 *        → appended to the journal as actor 'career-ops' (sync state 'external').
 *
 * Precedence: pending dashboard events are pushed first; afterwards the file wins.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Application, PipelineStage } from '../domain/types.ts';
import type { PipelineStore, StoredApplication } from '../persistence/pipeline.ts';
import { normalizeState, stateToStage, type TrackerRow } from '../data/career-ops/parse.ts';

/** Stages career-ops has no state for stay journal-only. */
export function stageToCareerOpsState(stage: PipelineStage, closedReason?: Application['closedReason'] | null): string | null {
  switch (stage) {
    case 'qualified':
      return 'Evaluated';
    case 'submitted':
      return 'Applied';
    case 'responded':
      return 'Responded';
    case 'interview':
      return 'Interview';
    case 'offer':
      return 'Offer';
    case 'closed':
      return closedReason === 'rejected' ? 'Rejected' : closedReason === 'hired' ? 'Hired' : 'Discarded';
    default:
      return null; // discovered, preparing, ready_for_review
  }
}

/** Tracker row number encoded in career-ops job ids ("co-<num>-<slug>"). */
export function trackerRowOf(jobId: string): number | null {
  const m = /^co-(\d+)-/.exec(jobId);
  return m ? Number(m[1]) : null;
}

export interface SyncConfig {
  /** Directory containing set-status.mjs (the career-ops code). */
  codeDir: string;
  /** career-ops data root (where data/applications.md lives). */
  dataRoot: string;
  /** Override for tests. */
  runner?: (args: string[]) => { status: number | null; stdout: string; stderr: string };
}

export interface SyncReport {
  pushed: { applied: number; notApplicable: number; failed: number; unchanged: number };
  pulled: number;
  details: string[];
  available: boolean;
  reason: string | null;
}

export function careerOpsWritable(cfg: SyncConfig): { ok: boolean; reason: string | null } {
  if (!existsSync(join(cfg.codeDir, 'set-status.mjs'))) return { ok: false, reason: `set-status.mjs não encontrado em ${cfg.codeDir}` };
  if (!existsSync(join(cfg.dataRoot, 'data', 'applications.md'))) return { ok: false, reason: 'data/applications.md ausente — sem tracker para escrever' };
  return { ok: true, reason: null };
}

function defaultRunner(cfg: SyncConfig) {
  return (args: string[]) => {
    const r = spawnSync(process.execPath, ['set-status.mjs', ...args], {
      cwd: cfg.codeDir,
      env: { ...process.env, CAREER_OPS_ROOT: cfg.dataRoot },
      encoding: 'utf8',
      timeout: 60_000,
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  };
}

/** Pushes one application's pending events in order. */
async function pushApp(store: PipelineStore, app: StoredApplication, events: StoredApplication['events'], cfg: SyncConfig, rep: SyncReport) {
  const row = trackerRowOf(app.job.jobId);
  const run = cfg.runner ?? defaultRunner(cfg);
  for (const ev of events) {
    const state = stageToCareerOpsState(ev.to, app.closedReason);
    if (!state) {
      await store.markSync(ev.id, 'not_applicable', `etapa "${ev.to}" não existe no career-ops (somente no diário)`);
      rep.pushed.notApplicable++;
      continue;
    }
    if (row == null) {
      await store.markSync(ev.id, 'not_applicable', 'vaga sem linha no tracker do career-ops (adicione via avaliação/merge-tracker)');
      rep.pushed.notApplicable++;
      continue;
    }
    const args = ['--row', String(row), state, '--on', ev.at.slice(0, 10), '--source', 'web', '--note', `career-os:${ev.id}`, '--json'];
    const r = run(args);
    let body: { changed?: boolean; newStatus?: string; error?: string } = {};
    try {
      body = JSON.parse(r.stdout || '{}');
    } catch {
      /* non-JSON output */
    }
    if (r.status === 0) {
      await store.markSync(ev.id, 'applied', `tracker #${row} → ${body.newStatus ?? state}${body.changed === false ? ' (já estava)' : ''}`);
      if (body.changed === false) rep.pushed.unchanged++;
      else rep.pushed.applied++;
      rep.details.push(`#${row} ${state} ← ${ev.id}`);
    } else {
      const reason = body.error ?? (r.stderr || r.stdout).trim().split('\n').slice(-1)[0] ?? `exit ${r.status}`;
      await store.markSync(ev.id, 'failed', reason.slice(0, 300));
      rep.pushed.failed++;
      rep.details.push(`FALHA #${row} ${state}: ${reason}`);
      return; // keep order: later events of this application wait for the next run
    }
  }
}

export async function pushPending(store: PipelineStore, cfg: SyncConfig, onlyJobId?: string): Promise<SyncReport> {
  const rep: SyncReport = { pushed: { applied: 0, notApplicable: 0, failed: 0, unchanged: 0 }, pulled: 0, details: [], available: true, reason: null };
  const w = careerOpsWritable(cfg);
  if (!w.ok && !cfg.runner) return { ...rep, available: false, reason: w.reason };
  const pending = await store.pendingSync();
  const byApp = new Map<string, { app: StoredApplication; events: StoredApplication['events'] }>();
  for (const p of pending) {
    if (onlyJobId && p.application.job.jobId !== onlyJobId) continue;
    const cur = byApp.get(p.application.id) ?? { app: p.application, events: [] };
    cur.events.push(p.event);
    byApp.set(p.application.id, cur);
  }
  for (const { app, events } of byApp.values()) await pushApp(store, app, events, cfg, rep);
  return rep;
}

/** File → journal: adopt status changes career-ops made by itself. Skips apps with unsynced events. */
export async function pullFromTracker(store: PipelineStore, rows: TrackerRow[], rep?: SyncReport): Promise<number> {
  const pendingIds = new Set((await store.pendingSync()).map((p) => p.application.id));
  let pulled = 0;
  for (const app of await store.list()) {
    const rowNum = trackerRowOf(app.job.jobId);
    if (rowNum == null || pendingIds.has(app.id)) continue;
    const row = rows.find((r) => Number(r.num) === rowNum);
    if (!row) continue;
    const fileStage = stateToStage(normalizeState(row.status));
    if (!fileStage || fileStage === app.stage) continue;
    // terminal "closed" in the journal and the same closed family in the file → equal
    await store.move(app.job.jobId, fileStage, `sincronizado do tracker (${row.status})`, 'career-ops');
    pulled++;
    rep?.details.push(`pull #${rowNum}: ${app.stage} → ${fileStage}`);
  }
  if (rep) rep.pulled += pulled;
  return pulled;
}
