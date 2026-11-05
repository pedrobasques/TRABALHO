'use client';

import { useState, type ReactNode } from 'react';
import { STAGE_LABEL, type PipelineStage } from '@career-os/core';
import { cn } from '@/lib/format';
import { STAGE_TONE } from './domain';

const DOT: Record<string, string> = { neutral: 'bg-subtle', info: 'bg-info', warning: 'bg-warning', accent: 'bg-accent', success: 'bg-success', danger: 'bg-danger' };

export function PipelineColumn({ stage, count, avgDays, children, onDropApp }: { stage: PipelineStage; count: number; avgDays?: number; children: ReactNode; onDropApp: (appId: string) => void }) {
  const [over, setOver] = useState(false);
  return (
    <section
      aria-label={`${STAGE_LABEL[stage]}: ${count}`}
      data-testid={`column-${stage}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData('text/plain');
        if (id) onDropApp(id);
      }}
      className={cn('flex w-[264px] shrink-0 flex-col rounded-xl border bg-surface/60 transition-colors', over ? 'border-accent bg-accent-soft' : 'border-border')}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('size-2 shrink-0 rounded-full', DOT[STAGE_TONE[stage]])} aria-hidden />
          <h2 className="truncate text-xs font-semibold text-fg">{STAGE_LABEL[stage]}</h2>
          <span className="tabular rounded bg-surface-2 px-1.5 text-[11px] font-medium text-muted">{count}</span>
        </div>
        {avgDays != null && <span className="tabular text-[10px] text-subtle" title="Tempo médio na etapa">~{avgDays}d</span>}
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">{children}</div>
    </section>
  );
}
