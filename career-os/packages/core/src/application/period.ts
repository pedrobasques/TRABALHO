import type { IsoDate } from '../domain/types.ts';

export type PeriodKey = '7d' | '30d' | '90d' | 'all';

export const PERIODS: { key: PeriodKey; label: string; days: number | null }[] = [
  { key: '7d', label: '7 dias', days: 7 },
  { key: '30d', label: '30 dias', days: 30 },
  { key: '90d', label: '90 dias', days: 90 },
  { key: 'all', label: 'Tudo', days: null },
];

export function isPeriodKey(v: unknown): v is PeriodKey {
  return typeof v === 'string' && PERIODS.some((p) => p.key === v);
}

const DAY = 86_400_000;

export function toTime(d: IsoDate): number {
  return Date.parse(d.length === 10 ? `${d}T00:00:00Z` : d);
}

export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((toTime(b) - toTime(a)) / DAY);
}

/** Inclusive window: (asOf − days, asOf]. */
export function inPeriod(date: IsoDate | null | undefined, period: PeriodKey, asOf: IsoDate): boolean {
  if (!date) return false;
  const p = PERIODS.find((x) => x.key === period);
  if (!p || p.days == null) return true;
  const t = toTime(date);
  const end = toTime(asOf) + DAY - 1;
  return t <= end && t > end - p.days * DAY;
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return new Date(toTime(d) + n * DAY).toISOString().slice(0, 10);
}
