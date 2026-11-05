import type { Salary } from '@career-os/core';

export function cn(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ');
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const shortFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });

const parse = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00Z` : d);

export function fmtDate(d: string | null | undefined, short = false): string {
  if (!d) return '—';
  const t = parse(d);
  if (Number.isNaN(t.getTime())) return '—';
  return (short ? shortFmt : dateFmt).format(t).replace('.', '');
}

export function fmtRelative(d: string | null | undefined, asOf: string): string {
  if (!d) return '—';
  const days = Math.round((parse(asOf).getTime() - parse(d).getTime()) / 86_400_000);
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days === -1) return 'amanhã';
  if (days < 0) return `em ${-days} dias`;
  if (days < 30) return `há ${days} dias`;
  const m = Math.round(days / 30);
  return `há ${m} ${m === 1 ? 'mês' : 'meses'}`;
}

export function fmtPct(x: number | null | undefined, digits = 0): string {
  if (x == null || Number.isNaN(x)) return '—';
  return `${(x * 100).toFixed(digits).replace('.', ',')}%`;
}

export function fmtInt(n: number): string {
  return n.toLocaleString('pt-BR');
}

export function fmtSalary(s: Salary | null): string {
  if (!s) return 'Não publicado';
  const f = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: s.currency, maximumFractionDigits: 0, notation: n >= 100000 ? 'compact' : 'standard' }).format(n);
  const per = s.period === 'year' ? '/ano' : s.period === 'month' ? '/mês' : '/h';
  if (s.min != null && s.max != null) return `${f(s.min)} – ${f(s.max)} ${per}`;
  if (s.min != null) return `a partir de ${f(s.min)} ${per}`;
  if (s.max != null) return `até ${f(s.max)} ${per}`;
  return 'Não publicado';
}
