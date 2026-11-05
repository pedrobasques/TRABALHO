'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Columns3, ExternalLink, GripVertical, History, Info, Rows3, X } from 'lucide-react';
import {
  STAGE_LABEL,
  STAGE_ORDER,
  countByStage,
  countryName,
  funnel,
  maxStageReached,
  timeInStage,
  type Application,
  type Job,
  type MatchResult,
  type PipelineStage,
} from '@career-os/core';
import { useStore } from '@/lib/store';
import { cn, fmtDate, fmtPct, fmtRelative } from '@/lib/format';
import { Button, Card, DemoIndicator, EmptyState, InfoNote, PageHeader, ScoreIndicator, SearchInput, Segmented, StatusBadge } from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/data-table';
import { CountryLabel, StageBadge } from '@/components/ui/domain';
import { PipelineColumn } from '@/components/ui/pipeline-column';
import { useToast } from '@/components/ui/toast';
import { MultiSelect } from '@/components/ui/filter-select';

const ALL_STAGES: PipelineStage[] = [...STAGE_ORDER, 'closed'];

interface Row {
  app: Application;
  job: Job;
  match: MatchResult;
}

function AppCard({ r, onOpen, origin }: { r: Row; onOpen: () => void; origin: 'persisted' | 'local' | null }) {
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', r.app.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className="group cursor-grab rounded-lg border border-border bg-surface p-3 shadow-sm transition-colors hover:border-border-strong active:cursor-grabbing"
      data-testid="app-card"
    >
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Abrir ${r.job.title} — ${r.job.company}`}>
        <div className="flex items-start gap-2">
          <ScoreIndicator score={r.match.overallScore} size="sm" blocked={r.match.category === 'blocked'} />
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[13px] leading-snug font-medium text-fg">{r.job.title}</div>
            <div className="mt-0.5 truncate text-xs text-muted">{r.job.company}</div>
          </div>
          <GripVertical className="size-3.5 shrink-0 text-subtle opacity-0 group-hover:opacity-100" aria-hidden />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge>
            <CountryLabel code={r.job.country} />
          </StatusBadge>
          {origin === 'local' && <StatusBadge tone="warning" title="Alteração somente neste navegador">navegador</StatusBadge>}
          {origin === 'persisted' && <StatusBadge tone="success" title="Registro persistido no servidor">salvo</StatusBadge>}
          {r.app.closedReason && <StatusBadge tone="neutral">{r.app.closedReason}</StatusBadge>}
        </div>
        {r.app.nextAction && (
          <div className="mt-2 flex items-start gap-1.5 border-t border-border pt-2 text-[11px] text-muted">
            <CalendarClock className="mt-px size-3 shrink-0" aria-hidden />
            <span className="line-clamp-2">{r.app.nextAction}</span>
          </div>
        )}
      </button>
    </article>
  );
}

export function Pipeline() {
  const { dataset, matches, moveApplication, changeOrigin, persistence } = useStore();
  const persisted = persistence.kind === 'file' || persistence.kind === 'postgres';
  const toast = useToast();
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [query, setQuery] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const openId = sp.get('open');

  const jobById = useMemo(() => new Map(dataset.jobs.map((j) => [j.id, j])), [dataset.jobs]);
  const rows: Row[] = useMemo(
    () =>
      dataset.applications
        .map((app) => ({ app, job: jobById.get(app.jobId)!, match: matches.get(app.jobId)! }))
        .filter((r) => r.job && r.match),
    [dataset.applications, jobById, matches],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (!q || `${r.job.title} ${r.job.company} ${r.app.nextAction ?? ''}`.toLowerCase().includes(q)) && (!countries.length || countries.includes(r.job.country)));
  }, [rows, query, countries]);
  const counts = useMemo(() => countByStage(filtered.map((r) => r.app)), [filtered]);
  const avg = useMemo(() => timeInStage(filtered.map((r) => r.app), dataset.asOf), [filtered, dataset.asOf]);
  const steps = useMemo(() => funnel({ jobs: [], applications: filtered.map((r) => r.app) }), [filtered]);
  const submitted = steps.find((s) => s.key === 'submitted')!.count;
  const responded = steps.find((s) => s.key === 'responded')!.count;
  const interview = steps.find((s) => s.key === 'interview')!.count;

  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (id) next.set('open', id);
    else next.delete('open');
    router.replace(`${path}${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };
  const move = (appId: string, stage: PipelineStage) => {
    const r = rows.find((x) => x.app.id === appId);
    if (!r || r.app.stage === stage) return;
    void moveApplication(appId, stage).then((res) => {
      if (!res.ok) return toast(`NÃO salvo — "${r.job.title}": ${res.error}`, 'error');
      const wb = res.writeBack;
      if (wb?.failed) return toast(`"${r.job.title}" → ${STAGE_LABEL[stage]}: salvo no diário, mas ${wb.detail}. Será tentado de novo em npm run sync.`, 'error');
      toast(`"${r.job.title}" → ${STAGE_LABEL[stage]} ${persisted ? '(salvo com histórico)' : '(somente neste navegador)'}. ${wb?.detail ?? ''} Nada é enviado a empresas.`);
    });
  };
  // An application adopted into the store gets a new id; keep the drawer bound to the same job.
  const [openJob, setOpenJob] = useState<string | null>(null);
  const open = rows.find((r) => r.app.id === openId) ?? (openId && openJob ? rows.find((r) => r.app.jobId === openJob) : undefined) ?? null;
  useEffect(() => {
    if (open && open.app.jobId !== openJob) setOpenJob(open.app.jobId);
  }, [open, openJob]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.app.id]);

  const columns: Column<Row>[] = [
    { key: 'company', header: 'Empresa', sortValue: (r) => r.job.company, cell: (r) => <span className="font-medium text-fg">{r.job.company}</span> },
    { key: 'title', header: 'Cargo', sortValue: (r) => r.job.title, className: 'max-w-[260px]', cell: (r) => <span className="block truncate text-fg">{r.job.title}</span> },
    { key: 'country', header: 'País', hideBelow: 'md', sortValue: (r) => countryName(r.job.country), cell: (r) => <CountryLabel code={r.job.country} className="text-xs" /> },
    { key: 'score', header: 'Score', align: 'right', sortValue: (r) => r.match.overallScore, cell: (r) => <span className="tabular font-medium">{r.match.overallScore}</span> },
    { key: 'stage', header: 'Etapa', sortValue: (r) => ALL_STAGES.indexOf(r.app.stage), cell: (r) => <StageBadge s={r.app.stage} /> },
    { key: 'updated', header: 'Última atualização', hideBelow: 'md', sortValue: (r) => r.app.history[r.app.history.length - 1]!.at, cell: (r) => <span className="tabular text-xs text-muted">{fmtDate(r.app.history[r.app.history.length - 1]!.at, true)}</span> },
    { key: 'next', header: 'Próxima ação', hideBelow: 'lg', className: 'max-w-[240px]', cell: (r) => <span className="block truncate text-xs text-muted">{r.app.nextAction ?? '—'}</span> },
  ];

  return (
    <div className="animate-in">
      <PageHeader
        eyebrow={dataset.origin === 'demo' ? <DemoIndicator /> : 'career-ops'}
        title="Application Pipeline"
        description="Acompanhe cada candidatura da descoberta à oferta. Arraste cards entre colunas ou use o painel de detalhes."
        actions={
          <Segmented
            label="Visualização"
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'kanban', label: 'Kanban', icon: <Columns3 className="size-3.5" /> },
              { value: 'table', label: 'Tabela', icon: <Rows3 className="size-3.5" /> },
            ]}
          />
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Ativas', filtered.filter((r) => r.app.stage !== 'closed').length],
          ['Enviadas (total)', submitted],
          ['Taxa de resposta', fmtPct(submitted ? responded / submitted : null)],
          ['Resposta → entrevista', fmtPct(responded ? interview / responded : null)],
        ].map(([k, v]) => (
          <Card key={k as string} className="px-4 py-3">
            <div className="text-xs text-muted">{k}</div>
            <div className="tabular mt-1 text-xl font-semibold text-fg">{v}</div>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput className="sm:w-72" label="Buscar candidaturas" placeholder="Buscar empresa, cargo, ação…" value={query} onChange={setQuery} />
        <MultiSelect label="País" value={countries} onChange={setCountries} options={[...new Set(rows.map((r) => r.job.country))].sort().map((c) => ({ value: c, label: countryName(c) }))} />
        <p className="text-xs text-subtle sm:ml-auto" data-testid="pipeline-persistence-note">
          {persisted ? `Movimentações persistidas (${persistence.kind === 'postgres' ? 'Supabase' : 'arquivo local'}) com histórico.` : persistence.kind === 'loading' ? 'Verificando persistência…' : 'Sem persistência no servidor: movimentações ficam só neste navegador.'}
          {dataset.origin === 'demo' ? ' Dados DEMO — não são candidaturas reais.' : ''}
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState title="Nenhuma candidatura ainda" description="Envie vagas ao pipeline a partir do Job Radar." action={<Link href="/jobs" className="text-sm font-medium text-accent hover:underline">Abrir Job Radar</Link>} />
        </Card>
      ) : view === 'kanban' ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0" data-testid="kanban">
          <div className="flex gap-3">
            {ALL_STAGES.map((stage) => (
              <PipelineColumn key={stage} stage={stage} count={counts[stage]} avgDays={avg[stage]} onDropApp={(id) => move(id, stage)}>
                {filtered
                  .filter((r) => r.app.stage === stage)
                  .map((r) => (
                    <AppCard key={r.app.id} r={r} origin={changeOrigin(r.app.id)} onOpen={() => setOpen(r.app.id)} />
                  ))}
                {counts[stage] === 0 && <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-border py-6 text-[11px] text-subtle">Vazia</div>}
              </PipelineColumn>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <DataTable testId="applications-table" caption="Candidaturas" rows={filtered} rowKey={(r) => r.app.id} columns={columns} onRowClick={(r) => setOpen(r.app.id)} initialSort={{ key: 'stage', dir: 'desc' }} empty={<EmptyState title="Nada encontrado" description="Ajuste a busca." />} />
        </Card>
      )}

      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={`Candidatura: ${open.job.title}`}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(null)} />
          <aside className="animate-in absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-bg-elevated shadow-card" data-testid="app-drawer">
            <div className="flex items-start justify-between gap-3 border-b border-border p-5">
              <div className="min-w-0">
                <StageBadge s={open.app.stage} />
                <h2 className="mt-2 text-lg leading-snug font-semibold text-fg">{open.job.title}</h2>
                <p className="text-sm text-muted">
                  {open.job.company} · {countryName(open.job.country)}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(null)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-fg" aria-label="Fechar">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="flex items-center gap-3">
                <ScoreIndicator score={open.match.overallScore} blocked={open.match.category === 'blocked'} />
                <div className="text-sm">
                  <div className="text-fg">Etapa máxima alcançada: {STAGE_LABEL[maxStageReached(open.app)]}</div>
                  <Link href={`/jobs/${open.job.id}`} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                    Ver análise da vaga <ExternalLink className="size-3" />
                  </Link>
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Mover para etapa</span>
                <select value={open.app.stage} onChange={(e) => move(open.app.id, e.target.value as PipelineStage)} className="h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-fg" data-testid="stage-select">
                  {ALL_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <InfoNote tone="info" icon={<Info className="size-3.5" />}>
                {persisted
                  ? 'Mudanças de etapa são gravadas no servidor com histórico. O tracker do career-ops (applications.md) não é alterado — sincronização de volta via set-status.mjs é planejada.'
                  : 'Sem persistência no servidor: mudanças ficam só neste navegador.'}{' '}
                Nada é enviado a empresas.
              </InfoNote>

              {open.app.nextAction && (
                <div>
                  <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Próxima ação</h3>
                  <p className="text-sm text-fg">{open.app.nextAction}</p>
                  {open.app.nextActionDue && <p className="text-xs text-muted">Prazo: {fmtDate(open.app.nextActionDue)} ({fmtRelative(open.app.nextActionDue, dataset.asOf)})</p>}
                </div>
              )}

              <div>
                <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
                  <History className="size-3.5" /> Histórico de status
                </h3>
                <ol className="relative space-y-3 border-l border-border pl-4" data-testid="history">
                  {[...open.app.history].reverse().map((h, i) => (
                    <li key={i} className="relative">
                      <span className={cn('absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-bg-elevated', i === 0 ? 'bg-accent' : 'bg-border-strong')} />
                      <div className="flex flex-wrap items-center gap-1.5 text-sm text-fg">
                        {STAGE_LABEL[h.stage]}
                        {h.sync && h.sync !== 'external' && (
                          <StatusBadge tone={h.sync === 'applied' ? 'success' : h.sync === 'failed' ? 'danger' : h.sync === 'pending' ? 'warning' : 'neutral'} title={h.syncDetail ?? undefined}>
                            {h.sync === 'applied' ? 'no tracker' : h.sync === 'failed' ? 'falha no tracker' : h.sync === 'pending' ? 'sincronização pendente' : 'só no diário'}
                          </StatusBadge>
                        )}
                      </div>
                      <div className="text-xs text-muted">
                        {fmtDate(h.at)}
                        {h.note ? ` · ${h.note}` : ''}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              {open.app.notes && <p className="text-xs text-subtle">{open.app.notes}</p>}
            </div>
            <div className="border-t border-border p-4">
              <Button className="w-full" onClick={() => setOpen(null)}>
                Fechar
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
