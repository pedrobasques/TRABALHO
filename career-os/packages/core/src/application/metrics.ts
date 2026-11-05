/**
 * Pipeline and portfolio metrics. All dashboard numbers come from here, so
 * every widget reads the same cohort and the same definitions.
 *
 * Cohort rule: a period selects jobs by `discoveredAt`; applications belong to
 * the cohort of their job. Funnel steps count applications that *reached* a
 * stage (from history), so a rejected-after-interview application still counts
 * as an interview. Conversion between steps uses the previous step as the
 * denominator; response rate = responded ÷ submitted.
 */
import { STAGE_ORDER, type Application, type Dataset, type IsoDate, type Job, type PipelineStage } from '../domain/types.ts';
import type { MatchResult } from '../matching/engine.ts';
import { addDays, daysBetween, inPeriod, toTime, type PeriodKey } from './period.ts';

export function stageIndex(stage: PipelineStage): number {
  return STAGE_ORDER.indexOf(stage);
}

/** Highest active stage reached according to history (closed is ignored). */
export function maxStageReached(app: Application): PipelineStage {
  let best = 0;
  for (const e of [...app.history, { stage: app.stage, at: '' }]) {
    const i = stageIndex(e.stage);
    if (i > best) best = i;
  }
  return STAGE_ORDER[best]!;
}

export function reached(app: Application, stage: PipelineStage): boolean {
  return stageIndex(maxStageReached(app)) >= stageIndex(stage);
}

export const safeRate = (num: number, den: number): number | null => (den > 0 ? num / den : null);

export interface Cohort {
  jobs: Job[];
  applications: Application[];
}

export function cohort(ds: Pick<Dataset, 'jobs' | 'applications' | 'asOf'>, period: PeriodKey, countries?: string[]): Cohort {
  const jobs = ds.jobs.filter(
    (j) => inPeriod(j.discoveredAt, period, ds.asOf) && (!countries?.length || countries.includes(j.country)),
  );
  const ids = new Set(jobs.map((j) => j.id));
  return { jobs, applications: ds.applications.filter((a) => ids.has(a.jobId)) };
}

export interface FunnelStep {
  key: 'identified' | 'qualified' | 'prepared' | 'submitted' | 'responded' | 'interview' | 'offer';
  label: string;
  count: number;
  /** Conversion from the previous step (null for the first step or empty denominator). */
  rateFromPrev: number | null;
}

export function funnel(c: Cohort): FunnelStep[] {
  const n = (s: PipelineStage) => c.applications.filter((a) => reached(a, s)).length;
  const raw: [FunnelStep['key'], string, number][] = [
    ['identified', 'Identificadas', c.jobs.length],
    ['qualified', 'Qualificadas', n('qualified')],
    ['prepared', 'Preparadas', n('preparing')],
    ['submitted', 'Enviadas', n('submitted')],
    ['responded', 'Respostas', n('responded')],
    ['interview', 'Entrevistas', n('interview')],
    ['offer', 'Ofertas', n('offer')],
  ];
  return raw.map(([key, label, count], i) => ({
    key,
    label,
    count,
    rateFromPrev: i === 0 ? null : safeRate(count, raw[i - 1]![2]),
  }));
}

export interface Kpis {
  identified: number;
  newLast7d: number;
  highFit: number;
  submitted: number;
  interviews: number;
  responseRate: number | null;
  responded: number;
}

export function kpis(ds: Dataset, c: Cohort, matches: Map<string, MatchResult>): Kpis {
  const f = funnel(c);
  const get = (k: FunnelStep['key']) => f.find((s) => s.key === k)!.count;
  return {
    identified: c.jobs.length,
    newLast7d: c.jobs.filter((j) => inPeriod(j.discoveredAt, '7d', ds.asOf)).length,
    highFit: c.jobs.filter((j) => {
      const m = matches.get(j.id);
      return j.status !== 'closed' && m && (m.category === 'excellent' || m.category === 'high');
    }).length,
    submitted: get('submitted'),
    interviews: get('interview'),
    responded: get('responded'),
    responseRate: safeRate(get('responded'), get('submitted')),
  };
}

export function countByStage(apps: Application[]): Record<PipelineStage, number> {
  const out = Object.fromEntries([...STAGE_ORDER, 'closed'].map((s) => [s, 0])) as Record<PipelineStage, number>;
  for (const a of apps) out[a.stage]++;
  return out;
}

/** Average days spent in each stage, from consecutive history events. Stages without data are omitted. */
export function timeInStage(apps: Application[], asOf: IsoDate): Partial<Record<PipelineStage, number>> {
  const acc: Partial<Record<PipelineStage, number[]>> = {};
  for (const a of apps) {
    const h = [...a.history].sort((x, y) => toTime(x.at) - toTime(y.at));
    h.forEach((e, i) => {
      if (e.stage === 'closed') return;
      const end = h[i + 1]?.at ?? asOf;
      (acc[e.stage] ??= []).push(Math.max(0, daysBetween(e.at, end)));
    });
  }
  const out: Partial<Record<PipelineStage, number>> = {};
  for (const [k, v] of Object.entries(acc) as [PipelineStage, number[]][]) {
    if (v.length) out[k] = Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10;
  }
  return out;
}

export interface WeekPoint {
  weekStart: IsoDate;
  discovered: number;
  submitted: number;
  responded: number;
}

/** Weekly series ending at asOf. */
export function weeklyTimeline(ds: Pick<Dataset, 'jobs' | 'applications' | 'asOf'>, weeks: number, countries?: string[]): WeekPoint[] {
  const jobs = ds.jobs.filter((j) => !countries?.length || countries.includes(j.country));
  const jobIds = new Set(jobs.map((j) => j.id));
  const apps = ds.applications.filter((a) => jobIds.has(a.jobId));
  const firstAt = (a: Application, s: PipelineStage) => a.history.find((e) => e.stage === s)?.at ?? null;
  const points: WeekPoint[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = addDays(ds.asOf, -7 * w - 6);
    const end = addDays(ds.asOf, -7 * w);
    const inW = (d: IsoDate | null) => d != null && d.slice(0, 10) >= start && d.slice(0, 10) <= end;
    points.push({
      weekStart: start,
      discovered: jobs.filter((j) => inW(j.discoveredAt)).length,
      submitted: apps.filter((a) => inW(firstAt(a, 'submitted'))).length,
      responded: apps.filter((a) => inW(firstAt(a, 'responded'))).length,
    });
  }
  return points;
}

export function countBy<T>(items: T[], key: (t: T) => string): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()].map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function scoreHistogram(jobs: Job[], matches: Map<string, MatchResult>, bucket = 10): { from: number; to: number; count: number }[] {
  const out = Array.from({ length: Math.ceil(100 / bucket) }, (_, i) => ({ from: i * bucket, to: Math.min(100, (i + 1) * bucket), count: 0 }));
  for (const j of jobs) {
    const s = matches.get(j.id)?.overallScore;
    if (s == null) continue;
    out[Math.min(out.length - 1, Math.floor(s / bucket))]!.count++;
  }
  return out;
}

/** Most demanded skills / certifications across jobs (must + nice). */
export function topSkills(jobs: Job[], limit = 10): { key: string; label: string; count: number; must: number }[] {
  const m = new Map<string, { label: string; count: number; must: number }>();
  for (const j of jobs) {
    for (const r of j.requirements) {
      if ((r.category !== 'skill' && r.category !== 'certification') || !r.key) continue;
      const cur = m.get(r.key) ?? { label: r.text, count: 0, must: 0 };
      cur.count++;
      if (r.kind === 'must') cur.must++;
      m.set(r.key, cur);
    }
  }
  return [...m.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

/** Skills most often required but missing / unverified in the profile. */
export function recurringGaps(jobs: Job[], matches: Map<string, MatchResult>, limit = 8) {
  const m = new Map<string, { label: string; missing: number; unknown: number }>();
  for (const j of jobs) {
    const r = matches.get(j.id);
    if (!r) continue;
    for (const x of [...r.missingRequirements, ...r.unknownRequirements]) {
      const k = x.requirement.key ?? x.requirement.text;
      const cur = m.get(k) ?? { label: x.requirement.text, missing: 0, unknown: 0 };
      if (x.status === 'not_met') cur.missing++;
      else cur.unknown++;
      m.set(k, cur);
    }
  }
  return [...m.entries()]
    .map(([key, v]) => ({ key, ...v, total: v.missing + v.unknown }))
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key))
    .slice(0, limit);
}
