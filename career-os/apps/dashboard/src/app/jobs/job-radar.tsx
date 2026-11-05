'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FilterX, LayoutGrid, Rows3, Star } from 'lucide-react';
import {
  AREA_LABEL,
  ELIGIBILITY_LABEL,
  EMPTY_FILTER,
  JOB_STATUS_LABEL,
  SENIORITY_LABEL,
  WORK_MODE_LABEL,
  applyJobFilter,
  countryName,
  facetValues,
  isFilterActive,
  jobsToCsv,
  paginate,
  type JobFilter,
  type JobRow,
  type JobSort,
} from '@career-os/core';
import { useStore } from '@/lib/store';
import { cn, fmtDate, fmtInt } from '@/lib/format';
import { Button, Card, DemoIndicator, EmptyState, PageHeader, ScoreIndicator, SearchInput, Segmented, StatusBadge } from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/data-table';
import { MultiSelect } from '@/components/ui/filter-select';
import { CountryLabel, EligibilityBadge, JobStatusBadge, OpportunityCard, RecoBadge } from '@/components/ui/domain';

const PAGE = 15;

const SORTS: { value: JobSort; label: string }[] = [
  { value: 'score', label: 'Maior aderência' },
  { value: 'priority', label: 'Prioridade' },
  { value: 'recent', label: 'Mais recentes' },
  { value: 'company', label: 'Empresa' },
  { value: 'country', label: 'País' },
];

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function JobRadar() {
  const { dataset, matches, isFavorite } = useStore();
  const sp = useSearchParams();
  const router = useRouter();
  const [filter, setFilter] = useState<JobFilter>(() => ({
    ...EMPTY_FILTER,
    query: sp.get('q') ?? '',
    countries: sp.get('country') ? [sp.get('country')!.toUpperCase()] : [],
  }));
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(1);
  const [favOnly, setFavOnly] = useState(false);

  // keep URL-driven entry points (global search, geo chart) in sync
  useEffect(() => {
    const q = sp.get('q');
    const c = sp.get('country');
    if (q != null || c != null) setFilter((f) => ({ ...f, query: q ?? f.query, countries: c ? [c.toUpperCase()] : f.countries }));
  }, [sp]);
  useEffect(() => setPage(1), [filter, favOnly]);

  const rows: JobRow[] = useMemo(() => dataset.jobs.map((job) => ({ job, match: matches.get(job.id)! })), [dataset.jobs, matches]);
  const facets = useMemo(() => facetValues(rows), [rows]);
  const filtered = useMemo(() => {
    const r = applyJobFilter(rows, filter);
    return favOnly ? r.filter((x) => isFavorite(x.job.id)) : r;
  }, [rows, filter, favOnly, isFavorite]);
  const pg = paginate(filtered, page, PAGE);
  const set = <K extends keyof JobFilter>(k: K, v: JobFilter[K]) => setFilter((f) => ({ ...f, [k]: v }));
  const count = (pred: (r: JobRow) => boolean) => rows.filter(pred).length;
  const active = isFilterActive(filter) || favOnly;

  const columns: Column<JobRow>[] = [
    { key: 'score', header: 'Score', sortValue: (r) => r.match.overallScore, cell: (r) => <ScoreIndicator score={r.match.overallScore} size="sm" blocked={r.match.category === 'blocked'} /> },
    {
      key: 'title',
      header: 'Vaga',
      sortValue: (r) => r.job.title,
      className: 'max-w-[320px]',
      cell: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium text-fg">{r.job.title}</span>
            {isFavorite(r.job.id) && <Star className="size-3 shrink-0 fill-warning text-warning" aria-label="Favorita" />}
          </div>
          <div className="truncate text-xs text-muted">
            {r.job.company} · {AREA_LABEL[r.job.area]}
          </div>
        </div>
      ),
    },
    { key: 'country', header: 'País', sortValue: (r) => countryName(r.job.country), cell: (r) => <CountryLabel code={r.job.country} className="text-xs" /> },
    { key: 'seniority', header: 'Senioridade', hideBelow: 'md', sortValue: (r) => r.job.seniority, cell: (r) => <span className="text-xs text-muted">{SENIORITY_LABEL[r.job.seniority]}</span> },
    { key: 'mode', header: 'Modalidade', hideBelow: 'lg', cell: (r) => <span className="text-xs text-muted">{WORK_MODE_LABEL[r.job.workMode]}</span> },
    { key: 'elig', header: 'Elegibilidade', hideBelow: 'sm', sortValue: (r) => r.match.eligibilityStatus, cell: (r) => <EligibilityBadge e={r.match.eligibilityStatus} detail={r.match.eligibilityDetail} /> },
    { key: 'reco', header: 'Recomendação', hideBelow: 'lg', cell: (r) => <RecoBadge r={r.match.recommendation} /> },
    { key: 'status', header: 'Status', hideBelow: 'lg', cell: (r) => <JobStatusBadge s={r.job.status} /> },
    { key: 'date', header: 'Publicada', hideBelow: 'md', align: 'right', sortValue: (r) => r.job.postedAt ?? r.job.discoveredAt, cell: (r) => <span className="tabular text-xs whitespace-nowrap text-muted">{fmtDate(r.job.postedAt, true)}</span> },
  ];

  return (
    <div className="animate-in">
      <PageHeader
        eyebrow={dataset.origin === 'demo' ? <DemoIndicator /> : 'career-ops'}
        title="Global Job Radar"
        description="Explore, filtre e priorize oportunidades. O score mede aderência ao perfil; elegibilidade é avaliada separadamente."
        actions={
          <>
            <Button size="sm" icon={<Download className="size-3.5" />} onClick={() => download('career-os-vagas.csv', jobsToCsv({ ...dataset, jobs: filtered.map((r) => r.job) }, matches), 'text/csv')}>
              CSV
            </Button>
            <Segmented
              label="Visualização"
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: 'table', label: 'Tabela', icon: <Rows3 className="size-3.5" /> },
                { value: 'cards', label: 'Cards', icon: <LayoutGrid className="size-3.5" /> },
              ]}
            />
          </>
        }
      />

      <Card className="mb-4 p-3" data-testid="filter-bar">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput className="lg:w-72" label="Buscar vagas" placeholder="Cargo, empresa, competência…" value={filter.query} onChange={(v) => set('query', v)} />
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect label="País" value={filter.countries} onChange={(v) => set('countries', v)} options={facets.countries.map((c) => ({ value: c, label: countryName(c), count: count((r) => r.job.country === c) }))} />
            <MultiSelect label="Área" value={filter.areas} onChange={(v) => set('areas', v)} options={facets.areas.map((a) => ({ value: a, label: AREA_LABEL[a], count: count((r) => r.job.area === a) }))} />
            <MultiSelect label="Senioridade" value={filter.seniorities} onChange={(v) => set('seniorities', v)} options={facets.seniorities.map((s) => ({ value: s, label: SENIORITY_LABEL[s], count: count((r) => r.job.seniority === s) }))} />
            <MultiSelect label="Modalidade" value={filter.workModes} onChange={(v) => set('workModes', v)} options={facets.workModes.map((s) => ({ value: s, label: WORK_MODE_LABEL[s] }))} />
            <MultiSelect label="Elegibilidade" value={filter.eligibility} onChange={(v) => set('eligibility', v)} options={facets.eligibility.map((s) => ({ value: s, label: ELIGIBILITY_LABEL[s], count: count((r) => r.match.eligibilityStatus === s) }))} />
            <MultiSelect label="Status" value={filter.statuses} onChange={(v) => set('statuses', v)} options={facets.statuses.map((s) => ({ value: s, label: JOB_STATUS_LABEL[s] }))} />
            <MultiSelect label="Empresa" value={filter.companies} onChange={(v) => set('companies', v)} options={facets.companies.map((s) => ({ value: s, label: s, count: count((r) => r.job.company === s) }))} />
            <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-muted">
              <span className="whitespace-nowrap">Score ≥</span>
              <input type="range" min={0} max={100} step={5} value={filter.minScore} onChange={(e) => set('minScore', Number(e.target.value))} className="w-20 accent-[var(--accent)]" aria-label="Score mínimo" />
              <span className="tabular w-6 text-right text-fg">{filter.minScore}</span>
            </label>
            <button
              type="button"
              aria-pressed={favOnly}
              onClick={() => setFavOnly((v) => !v)}
              className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm', favOnly ? 'border-warning/50 bg-warning-soft text-warning' : 'border-border bg-surface text-muted hover:text-fg')}
            >
              <Star className={cn('size-3.5', favOnly && 'fill-current')} /> Favoritas
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-xs text-muted" data-testid="result-count">
            <span className="tabular font-semibold text-fg">{fmtInt(filtered.length)}</span> de {fmtInt(rows.length)} vagas
            {filtered.length > 0 && (
              <>
                {' '}· média de aderência <span className="tabular font-medium text-fg">{Math.round(filtered.reduce((s, r) => s + r.match.overallScore, 0) / filtered.length)}</span> ·{' '}
                {filtered.filter((r) => r.match.category === 'blocked').length} bloqueadas
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-muted">
              Ordenar
              <select value={filter.sort} onChange={(e) => set('sort', e.target.value as JobSort)} className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-fg">
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            {active && (
              <Button
                size="sm"
                variant="ghost"
                icon={<FilterX className="size-3.5" />}
                onClick={() => {
                  setFilter({ ...EMPTY_FILTER, sort: filter.sort });
                  setFavOnly(false);
                  router.replace('/jobs', { scroll: false });
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title="Nenhuma vaga corresponde aos filtros"
            description="Remova algum filtro ou reduza o score mínimo."
            action={
              active ? (
                <Button size="sm" onClick={() => { setFilter(EMPTY_FILTER); setFavOnly(false); }}>
                  Limpar filtros
                </Button>
              ) : undefined
            }
          />
        ) : view === 'table' ? (
          <>
            <div className="hidden sm:block">
              <DataTable testId="jobs-table" caption="Vagas filtradas" rows={pg.items} rowKey={(r) => r.job.id} columns={columns} onRowClick={(r) => router.push(`/jobs/${r.job.id}`)} />
            </div>
            <div className="p-2 sm:hidden" data-testid="jobs-list-mobile">
              {pg.items.map((r) => (
                <OpportunityCard key={r.job.id} job={r.job} match={r.match} favorite={isFavorite(r.job.id)} compact />
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
            {pg.items.map((r) => (
              <Link key={r.job.id} href={`/jobs/${r.job.id}`} className="flex gap-3 rounded-lg border border-border bg-surface-2/40 p-4 transition-colors hover:border-border-strong hover:bg-surface-hover">
                <ScoreIndicator score={r.match.overallScore} blocked={r.match.category === 'blocked'} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-fg">{r.job.title}</div>
                  <div className="truncate text-xs text-muted">{r.job.company}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StatusBadge>
                      <CountryLabel code={r.job.country} />
                    </StatusBadge>
                    <EligibilityBadge e={r.match.eligibilityStatus} />
                    <RecoBadge r={r.match.recommendation} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        {filtered.length > PAGE && (
          <nav aria-label="Paginação" className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted">
            <span className="tabular">
              Página {pg.page} de {pg.pages}
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={pg.page <= 1} onClick={() => setPage(pg.page - 1)} aria-label="Página anterior" icon={<ChevronLeft className="size-4" />} />
              <Button size="sm" variant="ghost" disabled={pg.page >= pg.pages} onClick={() => setPage(pg.page + 1)} aria-label="Próxima página" icon={<ChevronRight className="size-4" />} />
            </div>
          </nav>
        )}
      </Card>
    </div>
  );
}
