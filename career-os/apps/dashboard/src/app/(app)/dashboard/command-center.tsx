'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CalendarClock,
  ClipboardCheck,
  Globe2,
  MessageSquareReply,
  Send,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  UserRoundCheck,
} from 'lucide-react';
import {
  PERIODS,
  buildActions,
  cohort,
  countBy,
  countryName,
  funnel,
  kpis,
  type ActionItem,
} from '@career-os/core';
import { useStore } from '@/lib/store';
import { usePeriod } from '@/lib/use-period';
import { fmtDate, fmtInt, fmtPct, fmtRelative, cn } from '@/lib/format';
import { Card, CardHeader, DemoIndicator, EmptyState, MetricCard, PageHeader, Segmented, StatusBadge } from '@/components/ui/primitives';
import { CountryLabel, OpportunityCard } from '@/components/ui/domain';
import { BarList, FunnelChart } from '@/components/charts/charts';

const PRIORITY_COUNTRIES = ['BR', 'IT', 'DE', 'ES', 'NL', 'US', 'AU'];
const CAT_RANK = { excellent: 0, high: 1, moderate: 2, low: 3, blocked: 4 } as const;

const ACTION_ICON: Record<ActionItem['kind'], typeof AlertCircle> = {
  triage: Sparkles,
  review: ClipboardCheck,
  eligibility: AlertCircle,
  profile: UserRoundCheck,
  interview: CalendarClock,
  followup: MessageSquareReply,
  automation: Bot,
};

export function CommandCenter() {
  const { dataset, matches, isFavorite } = useStore();
  const [period, setPeriod] = usePeriod('30d');
  const router = useRouter();

  const c = useMemo(() => cohort(dataset, period), [dataset, period]);
  const k = useMemo(() => kpis(dataset, c, matches), [dataset, c, matches]);
  const steps = useMemo(() => funnel(c), [c]);
  const actions = useMemo(() => buildActions(dataset, matches), [dataset, matches]);
  const top = useMemo(
    () =>
      c.jobs
        .filter((j) => j.status !== 'closed')
        .map((job) => ({ job, match: matches.get(job.id)! }))
        .filter((r) => r.match.category !== 'blocked')
        // category first (it already accounts for eligibility and data sufficiency), then score
        .sort((a, b) => CAT_RANK[a.match.category] - CAT_RANK[b.match.category] || b.match.overallScore - a.match.overallScore)
        .slice(0, 6),
    [c, matches],
  );
  const byCountry = useMemo(() => {
    const counts = new Map(countBy(c.jobs, (j) => j.country).map((x) => [x.key, x.count]));
    const keys = [...new Set([...PRIORITY_COUNTRIES, ...counts.keys()])];
    return keys
      .map((key) => ({ key, label: <CountryLabel code={key} />, value: counts.get(key) ?? 0, hint: `${countryName(key)}: ${counts.get(key) ?? 0} vagas` }))
      .sort((a, b) => b.value - a.value || PRIORITY_COUNTRIES.indexOf(a.key) - PRIORITY_COUNTRIES.indexOf(b.key));
  }, [c]);

  const active = dataset.applications.filter((a) => a.stage !== 'closed').length;
  const openJobs = c.jobs.filter((j) => j.status !== 'closed').length;
  const periodLabel = PERIODS.find((p) => p.key === period)!.label;

  return (
    <div className="animate-in">
      <PageHeader
        eyebrow={dataset.origin === 'demo' ? <DemoIndicator /> : 'Dados do career-ops'}
        title="Career Command Center"
        description={`${fmtInt(openJobs)} vagas abertas no período · ${fmtInt(active)} candidaturas ativas · ${actions.filter((a) => a.priority <= 1).length} ações prioritárias`}
        actions={
          <>
            <Segmented label="Período" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.key, label: p.label }))} />
            <span className="hidden text-xs text-subtle sm:inline" title="Data de referência dos dados">
              Atualizado: <span className="tabular">{fmtDate(dataset.asOf)}</span>
            </span>
            <Link href="/settings" className="grid size-9 place-items-center rounded-lg border border-border bg-surface text-muted hover:text-fg" aria-label="Configurações">
              <Settings className="size-4" />
            </Link>
          </>
        }
      />

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <MetricCard testId="kpi-identified" label="Vagas identificadas" value={fmtInt(k.identified)} hint={`no período (${periodLabel})`} icon={<Globe2 className="size-4" />} tone="accent" />
        <MetricCard testId="kpi-new" label="Novas vagas" value={fmtInt(k.newLast7d)} hint="últimos 7 dias" icon={<Sparkles className="size-4" />} tone="info" />
        <MetricCard testId="kpi-highfit" label="Alta aderência" value={fmtInt(k.highFit)} hint="abertas, excelente/alta" icon={<Target className="size-4" />} tone="success" />
        <MetricCard testId="kpi-submitted" label="Candidaturas enviadas" value={fmtInt(k.submitted)} hint="chegaram a 'Enviada'" icon={<Send className="size-4" />} tone="accent" />
        <MetricCard testId="kpi-interviews" label="Entrevistas" value={fmtInt(k.interviews)} hint="chegaram a 'Entrevista'" icon={<CalendarClock className="size-4" />} tone="success" />
        <MetricCard testId="kpi-response" label="Taxa de resposta" value={fmtPct(k.responseRate)} hint={`${k.responded} de ${k.submitted} enviadas`} icon={<TrendingUp className="size-4" />} tone="warning" />
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Funil de recrutamento"
            subtitle="Quantas oportunidades avançam em cada etapa? (coorte de vagas descobertas no período; % = conversão da etapa anterior)"
            action={<Link href={`/analytics?period=${period}`} className="text-xs font-medium text-accent hover:underline">Analytics</Link>}
          />
          <div className="px-5 pb-5">
            <FunnelChart steps={steps} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Action Center" subtitle="O que precisa da sua atenção agora" action={<StatusBadge tone="accent">{actions.length}</StatusBadge>} />
          <ul className="max-h-[340px] space-y-0.5 overflow-y-auto px-2 pb-3" data-testid="action-center">
            {actions.length === 0 && <EmptyState title="Nada pendente" description="Nenhuma ação derivada dos dados atuais." />}
            {actions.slice(0, 12).map((a) => {
              const Icon = ACTION_ICON[a.kind];
              return (
                <li key={a.id}>
                  <Link href={a.href} className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-surface-hover">
                    <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg', a.overdue ? 'bg-danger-soft text-danger' : a.priority <= 1 ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-muted')}>
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-fg">{a.title}</span>
                      <span className="block truncate text-xs text-muted">{a.detail}</span>
                    </span>
                    {a.due && (
                      <span className={cn('tabular shrink-0 text-[11px]', a.overdue ? 'font-medium text-danger' : 'text-subtle')}>{fmtRelative(a.due, dataset.asOf)}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Oportunidades recomendadas"
            subtitle="Maior aderência no período, excluindo vagas encerradas e bloqueadas por requisito obrigatório"
            action={
              <Link href="/jobs" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                Ver radar <ArrowRight className="size-3" />
              </Link>
            }
          />
          <div className="px-2 pb-3" data-testid="top-opportunities">
            {top.length === 0 ? (
              <EmptyState title="Sem oportunidades no período" description="Amplie o período ou execute uma coleta." />
            ) : (
              top.map((r) => <OpportunityCard key={r.job.id} job={r.job} match={r.match} favorite={isFavorite(r.job.id)} />)
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Distribuição geográfica" subtitle="Onde estão as oportunidades do período? Clique para filtrar o radar." />
          <div className="px-5 pb-5" data-testid="geo-chart">
            <BarList data={byCountry} onSelect={(key) => router.push(`/jobs?country=${key}`)} />
          </div>
        </Card>
      </div>

      {dataset.origin === 'demo' && (
        <p className="mt-6 text-center text-xs text-subtle">
          Todos os números acima são calculados a partir do conjunto DEMO (empresas e candidaturas fictícias). Nenhuma candidatura real foi enviada.
        </p>
      )}
    </div>
  );
}
