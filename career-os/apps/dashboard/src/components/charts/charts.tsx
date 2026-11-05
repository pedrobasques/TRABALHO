'use client';

/**
 * Minimal, dependency-free charts. Each renders from plain arrays, scales to
 * its container, exposes values via tooltip/title + an sr-only table, and
 * shows an empty state when there is no data.
 */
import { useState, type ReactNode } from 'react';
import { cn, fmtInt, fmtPct } from '@/lib/format';

const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

function NoData({ children = 'Sem dados no período selecionado.' }: { children?: ReactNode }) {
  return <div className="grid h-32 place-items-center rounded-lg border border-dashed border-border text-xs text-muted">{children}</div>;
}

/* ------------------------------------------------------------------ BarList */

export function BarList({
  data,
  valueLabel = (v) => fmtInt(v),
  onSelect,
  selected,
  color = 'var(--chart-1)',
  max: maxOverride,
}: {
  data: { key: string; label: ReactNode; value: number; hint?: string }[];
  valueLabel?: (v: number) => string;
  onSelect?: (key: string) => void;
  selected?: string[];
  color?: string;
  max?: number;
}) {
  if (!data.length) return <NoData />;
  const max = maxOverride ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-1.5" role="list">
      {data.map((d) => {
        const active = selected?.includes(d.key);
        const content = (
          <>
            <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-surface-2">
              <div className="absolute inset-y-0 left-0 rounded-md transition-[width] duration-300" style={{ width: `${(d.value / max) * 100}%`, background: color, opacity: selected?.length && !active ? 'calc(var(--bar-alpha) * 0.4)' : 'var(--bar-alpha)' }} />
              <span className="relative z-10 flex h-full items-center truncate px-2.5 text-xs font-medium text-fg">{d.label}</span>
            </div>
            <span className="tabular w-12 shrink-0 text-right text-xs font-medium text-muted">{valueLabel(d.value)}</span>
          </>
        );
        return (
          <li key={d.key} title={d.hint ?? `${d.value}`}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(d.key)} aria-pressed={!!active} className="flex w-full items-center gap-2 rounded-md text-left hover:opacity-90">
                {content}
              </button>
            ) : (
              <div className="flex items-center gap-2">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* --------------------------------------------------------------- Funnel */

export function FunnelChart({ steps }: { steps: { key: string; label: string; count: number; rateFromPrev: number | null }[] }) {
  const max = Math.max(steps[0]?.count ?? 0, 1);
  if (!steps.length || steps.every((s) => s.count === 0)) return <NoData />;
  return (
    <div className="space-y-1.5" data-testid="funnel">
      {steps.map((s, i) => (
        <div key={s.key} className="grid grid-cols-[96px_1fr_auto] items-center gap-3 sm:grid-cols-[120px_1fr_auto]">
          <span className="truncate text-xs text-muted">{s.label}</span>
          <div className="relative h-7 overflow-hidden rounded-md bg-surface-2" title={`${s.label}: ${s.count}`}>
            <div
              className="absolute inset-y-0 left-0 rounded-md transition-[width] duration-300"
              style={{ width: `${Math.max(s.count ? 2 : 0, (s.count / max) * 100)}%`, background: `color-mix(in srgb, var(--chart-1) ${100 - i * 9}%, var(--chart-2))`, opacity: 'var(--bar-alpha)' }}
            />
            <span className="tabular relative z-10 flex h-full items-center px-2.5 text-xs font-semibold text-fg">{fmtInt(s.count)}</span>
          </div>
          <span className="tabular w-14 text-right text-[11px] text-subtle" title="Conversão a partir da etapa anterior">
            {i === 0 ? '' : fmtPct(s.rateFromPrev)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- LineChart */

export function LineChart({
  labels,
  series,
  height = 200,
}: {
  labels: string[];
  series: { name: string; values: number[]; color?: string }[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = series.reduce((s, x) => s + x.values.reduce((a, b) => a + b, 0), 0);
  if (!labels.length || total === 0) return <NoData />;
  const W = 600;
  const H = height;
  const P = { l: 28, r: 26, t: 10, b: 22 };
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const niceMax = Math.ceil(max / 2) * 2;
  const x = (i: number) => P.l + (labels.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (labels.length - 1));
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / niceMax);
  const ticks = [0, niceMax / 2, niceMax];
  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap gap-3">
        {series.map((s, i) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span className="size-2 rounded-full" style={{ background: s.color ?? SERIES[i] }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img" aria-label={`Evolução: ${series.map((s) => s.name).join(', ')}`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeDasharray={t === 0 ? undefined : '3 4'} />
            <text x={P.l - 6} y={y(t) + 3} textAnchor="end" className="fill-[var(--fg-subtle)] text-[10px]">
              {t}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={l + i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-[var(--fg-subtle)] text-[10px]">
            {labels.length > 8 && i % 2 ? '' : l}
          </text>
        ))}
        {series.map((s, si) => {
          const c = s.color ?? SERIES[si]!;
          const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
          return (
            <g key={s.name}>
              <path d={`${d} L${x(s.values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={c} opacity={0.08} />
              <path d={d} fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 4 : 2.5} fill={c} stroke="var(--surface)" strokeWidth={1.5} />
              ))}
            </g>
          );
        })}
        {labels.map((_, i) => (
          <rect
            key={i}
            x={x(i) - (W - P.l - P.r) / Math.max(1, labels.length - 1) / 2}
            y={0}
            width={(W - P.l - P.r) / Math.max(1, labels.length - 1)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="var(--border-strong)" />}
      </svg>
      {hover != null && (
        <div
          className="pointer-events-none absolute top-8 z-10 rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-xs shadow-card"
          style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% - 60px), calc(100% - 140px))` }}
        >
          <div className="mb-0.5 font-medium text-fg">{labels[hover]}</div>
          {series.map((s, si) => (
            <div key={s.name} className="flex items-center gap-1.5 text-muted">
              <span className="size-1.5 rounded-full" style={{ background: s.color ?? SERIES[si] }} />
              {s.name}: <span className="tabular font-medium text-fg">{s.values[hover]}</span>
            </div>
          ))}
        </div>
      )}
      <div className="sr-only">
      <table>
        <thead>
          <tr>
            <th>Período</th>
            {series.map((s) => (
              <th key={s.name}>{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((l, i) => (
            <tr key={l + i}>
              <td>{l}</td>
              {series.map((s) => (
                <td key={s.name}>{s.values[i]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- ColumnChart */

export function ColumnChart({ data, height = 160, color = 'var(--chart-1)', highlight }: { data: { label: string; value: number; tone?: string }[]; height?: number; color?: string; highlight?: (i: number) => boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length || data.every((d) => d.value === 0)) return <NoData />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join('; ')}>
        {data.map((d, i) => (
          <div key={d.label} className="relative flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {hover === i && (
              <div className="tabular absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded border border-border bg-bg-elevated px-1.5 py-0.5 text-[11px] whitespace-nowrap text-fg shadow-card">
                {d.label}: {d.value}
              </div>
            )}
            <div
              className="w-full rounded-t-[4px] transition-[height] duration-300"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0, background: d.tone ?? color, opacity: highlight && !highlight(i) ? 0.35 : hover === i ? 1 : 0.85 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        {data.map((d, i) => (
          <span key={d.label} className={cn('flex-1 text-center text-[10px] text-subtle', data.length > 6 && i % 2 === 1 && 'invisible sm:visible')}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- StackedBar */

export function StackedBar({ data }: { data: { key: string; label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <NoData />;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2" role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join('; ')}>
        {data
          .filter((d) => d.value > 0)
          .map((d) => (
            <div key={d.key} title={`${d.label}: ${d.value}`} style={{ width: `${(d.value / total) * 100}%`, background: d.color }} />
          ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="size-2 shrink-0 rounded-sm" style={{ background: d.color }} />
            <span className="truncate">{d.label}</span>
            <span className="tabular ml-auto font-medium text-fg">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
