'use client';

import { AlertTriangle, FlaskConical, Inbox, Loader2, RotateCcw, Search, X } from 'lucide-react';
import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/format';

/* ------------------------------------------------------------------ Button */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover border-transparent',
  secondary: 'bg-surface-2 text-fg hover:bg-surface-hover border-border',
  ghost: 'bg-transparent text-muted hover:text-fg hover:bg-surface-hover border-transparent',
  danger: 'bg-danger-soft text-danger hover:bg-danger/20 border-transparent',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: ReactNode }>(
  function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        {...rest}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors duration-150',
          'disabled:cursor-not-allowed disabled:opacity-50',
          size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
          VARIANT[variant],
          className,
        )}
      >
        {icon}
        {children}
      </button>
    );
  },
);

/* ------------------------------------------------------------------- Card */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cn('rounded-xl border border-border bg-surface shadow-card', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          {icon && <span className="text-muted">{icon}</span>}
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------- PageHeader */

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ------------------------------------------------------------------ Badge */

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-border',
  accent: 'bg-accent-soft text-accent border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  info: 'bg-info-soft text-info border-transparent',
};

export function StatusBadge({ tone = 'neutral', children, className, title, dot }: { tone?: Tone; children: ReactNode; className?: string; title?: string; dot?: boolean }) {
  return (
    <span title={title} className={cn('inline-flex max-w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap', TONE[tone], className)}>
      {dot && <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

/* --------------------------------------------------------- DemoIndicator */

export function DemoIndicator({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-warning uppercase', className)}
      title="Dados demonstrativos: empresas, vagas e candidaturas fictícias"
      data-testid="demo-indicator"
    >
      <FlaskConical className="size-3" aria-hidden />
      {compact ? 'Demo' : 'Dados DEMO'}
    </span>
  );
}

/* -------------------------------------------------------------- MetricCard */

export function MetricCard({ label, value, hint, icon, tone = 'neutral', testId }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: Tone; testId?: string }) {
  const iconTone: Record<Tone, string> = {
    neutral: 'text-muted bg-surface-2',
    accent: 'text-accent bg-accent-soft',
    success: 'text-success bg-success-soft',
    warning: 'text-warning bg-warning-soft',
    danger: 'text-danger bg-danger-soft',
    info: 'text-info bg-info-soft',
  };
  return (
    <Card className="p-4" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted">{label}</span>
        {icon && <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg', iconTone[tone])}>{icon}</span>}
      </div>
      <div className="tabular mt-2 text-2xl font-semibold tracking-tight text-fg" data-testid={testId ? `${testId}-value` : undefined}>
        {value}
      </div>
      {hint && <div className="mt-1 truncate text-xs text-subtle">{hint}</div>}
    </Card>
  );
}

/* ----------------------------------------------------------- ScoreIndicator */

export function scoreTone(score: number): Tone {
  return score >= 80 ? 'success' : score >= 65 ? 'accent' : score >= 50 ? 'warning' : 'neutral';
}

export function ScoreIndicator({ score, size = 'md', blocked, label }: { score: number; size?: 'sm' | 'md' | 'lg'; blocked?: boolean; label?: string }) {
  const dim = size === 'lg' ? 88 : size === 'md' ? 44 : 32;
  const stroke = size === 'lg' ? 7 : size === 'md' ? 4 : 3;
  const r = (dim - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = blocked ? 'danger' : scoreTone(score);
  const color = `var(--${tone === 'neutral' ? 'fg-subtle' : tone})`;
  return (
    <div
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: dim, height: dim }}
      role="img"
      aria-label={label ?? `Score de aderência ${score} de 100${blocked ? ', bloqueada por requisito obrigatório' : ''}`}
      title={blocked ? 'Bloqueada por requisito obrigatório — o score mede aderência, não elegibilidade' : `Aderência estimada: ${score}/100`}
    >
      <svg width={dim} height={dim} className="-rotate-90" aria-hidden>
        <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          opacity={blocked ? 0.55 : 1}
          style={{ transition: 'stroke-dashoffset 400ms ease' }}
        />
      </svg>
      <span className={cn('tabular absolute font-semibold', size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-sm' : 'text-[11px]', blocked ? 'text-danger' : 'text-fg')}>{score}</span>
    </div>
  );
}

/* ----------------------------------------------------------- SearchInput */

export function SearchInput({ value, onChange, placeholder, label, className }: { value: string; onChange: (v: string) => void; placeholder?: string; label: string; className?: string }) {
  return (
    <label className={cn('relative block', className)}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-border bg-surface pr-8 pl-9 text-sm text-fg placeholder:text-subtle hover:border-border-strong focus:border-accent focus:outline-none"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-subtle hover:text-fg" aria-label="Limpar busca">
          <X className="size-3.5" />
        </button>
      )}
    </label>
  );
}

/* ------------------------------------------------------------ Segmented */

export function Segmented<T extends string>({ value, onChange, options, label, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: ReactNode }[]; label: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors',
            size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-xs',
            value === o.value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------- Empty / Loading / Error */

export function EmptyState({ title, description, action, icon }: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center" data-testid="empty-state">
      <div className="mb-3 grid size-10 place-items-center rounded-xl bg-surface-2 text-muted">{icon ?? <Inbox className="size-5" />}</div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ rows = 4, label = 'Carregando' }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-3 p-5" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${90 - i * 12}%` }} />
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function Spinner() {
  return <Loader2 className="size-4 animate-spin" aria-hidden />;
}

export function ErrorState({ title = 'Algo deu errado', description, onRetry }: { title?: string; description?: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 grid size-10 place-items-center rounded-xl bg-danger-soft text-danger">
        <AlertTriangle className="size-5" />
      </div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {onRetry && (
        <Button className="mt-4" onClick={onRetry} icon={<RotateCcw className="size-3.5" />}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------ ConfirmationDialog */

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  tone = 'primary',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(92vw,420px)] rounded-xl border border-border bg-bg-elevated p-0 text-fg shadow-card backdrop:bg-black/60 backdrop:backdrop-blur-[2px]"
      aria-labelledby="confirm-title"
    >
      <div className="p-5">
        <h2 id="confirm-title" className="text-base font-semibold">
          {title}
        </h2>
        {description && <div className="mt-2 text-sm text-muted">{description}</div>}
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}

/* --------------------------------------------------------------- Tooltip-ish */

export function InfoNote({ children, tone = 'neutral', icon }: { children: ReactNode; tone?: Tone; icon?: ReactNode }) {
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-xs', TONE[tone])}>
      {icon && <span className="mt-px shrink-0">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
