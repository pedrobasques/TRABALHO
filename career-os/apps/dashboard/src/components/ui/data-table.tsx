'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/format';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** Hide on narrow screens. */
  hideBelow?: 'sm' | 'md' | 'lg';
}

const HIDE = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' } as const;

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  initialSort,
  empty,
  caption,
  testId,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  empty?: ReactNode;
  caption: string;
  testId?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const f = col.sortValue;
    return [...rows].sort((a, b) => {
      const x = f(a);
      const y = f(b);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR');
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, columns, sort]);

  if (!rows.length && empty) return <>{empty}</>;

  return (
    <div className="overflow-x-auto" data-testid={testId}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const ariaSort = active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={cn('px-4 py-2.5 text-xs font-medium whitespace-nowrap text-muted', c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left', c.hideBelow && HIDE[c.hideBelow])}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      className={cn('inline-flex items-center gap-1 rounded hover:text-fg', active && 'text-fg')}
                      onClick={() => setSort(active ? { key: c.key, dir: sort!.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'desc' })}
                    >
                      {c.header}
                      {active ? sort!.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn('border-b border-border/60 last:border-0', onRowClick && 'cursor-pointer transition-colors hover:bg-surface-hover')}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn('px-4 py-3 align-middle', c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left', c.hideBelow && HIDE[c.hideBelow], c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
