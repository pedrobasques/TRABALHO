'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/format';

/** Accessible multi-select popover used by the FilterBar. */
export function MultiSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; count?: number }[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors',
          value.length ? 'border-accent/50 bg-accent-soft text-fg' : 'border-border bg-surface text-muted hover:border-border-strong hover:text-fg',
        )}
      >
        {label}
        {value.length > 0 && <span className="tabular rounded bg-accent px-1 text-[11px] font-semibold text-accent-fg">{value.length}</span>}
        <ChevronDown className="size-3.5 opacity-60" />
      </button>
      {open && (
        <div id={id} role="listbox" aria-multiselectable aria-label={label} className="animate-in absolute top-full left-0 z-30 mt-1 max-h-72 w-60 overflow-auto rounded-lg border border-border bg-bg-elevated p-1 shadow-card">
          {options.length === 0 && <div className="px-2 py-1.5 text-xs text-muted">Sem opções</div>}
          {options.map((o) => {
            const on = value.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => toggle(o.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg hover:bg-surface-hover"
              >
                <span className={cn('grid size-4 shrink-0 place-items-center rounded border', on ? 'border-accent bg-accent text-accent-fg' : 'border-border-strong')}>{on && <Check className="size-3" />}</span>
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.count != null && <span className="tabular text-xs text-subtle">{o.count}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
