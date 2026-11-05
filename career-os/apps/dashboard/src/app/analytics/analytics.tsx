'use client';

import { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import {
  AREA_LABEL,
  PERIODS,
  STAGE_LABEL,
  STAGE_ORDER,
  cohort,
  countBy,
  countByStage,
  countryName,
  executiveReport,
  funnel,
  jobsToCsv,
  kpis,
  recurringGaps,
  scoreHistogram,
  topSkills,
  weeklyTimeline,
  type JobArea,
  type PeriodKey,
  type PipelineStage,
} from '@career-os/core';
import { useStore } from '@/lib/store';
import { usePeriod } from '@/lib/use-period';
import { fmtDate, fmtPct } from '@/lib/format';
import { Button, Card, DemoIndicator, MetricCard, PageHeader, Segmented } from '@/components/ui/primitives';
import { ChartCard } from '@/components/ui/chart-card';
import { MultiSelect } from '@/components/ui/filter-select';
import { CountryLabel } from '@/components/ui/domain';
import { BarList, ColumnChart, FunnelChart, LineChart, StackedBar } from '@/components/charts/charts';

const WEEKS: Record<PeriodKey, number> = { '7d': 4, '30d': 6, '90d': 13, all: 16 };
const STAGE_COLOR: Record<PipelineStage, string> = {
  discovered: 'var(--fg-subtle)',
  qualified: 'var(--chart-3)',
  preparing: 'color-mix(in srgb, var(--chart-3) 60%, var(--chart-1))',
  ready_for_review: 'var(--chart-4)',
  submitted: 'var(--chart-1)',
  responded: 'var(--chart-5)',
  interview: 'var(--chart-2)',
  offer: 'color-mix(in srgb, var(--chart-2) 70%, white)',
  closed: 'var(--border-strong)',
};

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function Analytics() {
  const { dataset, matches } = useStore();
  const [period, setPeriod] = usePeriod('90d');
  const [countries, setCountries] = useState<string[]>([]);

  const scoped = useMemo(() => (countries.length ? { ...dataset, jobs: dataset.jobs.filter((j) => countries.includes(j.country)) } : dataset), [dataset, countries]);
  const c = useMemo(() => cohort(scoped, period), [scoped, period]);
  const k = useMemo(() => kpis(scoped, c, matches), [scoped, c, matches]);
  const steps = useMemo(() => funnel(c), [c]);
  const tl = useMemo(() => weeklyTimeline(dataset, WEEKS[period], countries), [dataset, period, countries]);
  const byCountry = useMemo(() => countBy(c.jobs, (j) => j.country), [c]);
  const byArea = useMemo(() => countBy(c.jobs, (j) => j.area), [c]);
  const hist = useMemo(() => scoreHistogram(c.jobs, matches), [c, matches]);
  const stages = useMemo(() => countByStage(c.applications), [c]);
  const skills = useMemo(() => topSkills(c.jobs, 8), [c]);
  const gaps = useMemo(() => recurringGaps(c.jobs.filter((j) => j.status !== 'closed'), matches, 6), [c, matches]);
  const avgScore = c.jobs.length ? Math.round(c.jobs.reduce((s, j) => s + matches.get(j.id)!.overallScore, 0) / c.jobs.length) : null;
  const blocked = c.jobs.filter((j) => matches.get(j.id)!.category === 'blocked').length;

  return (
    <div className="animate-in">
      <PageHeader
        eyebrow={dataset.origin === 'demo' ? <DemoIndicator /> : 'career-ops'}
        title="Analytics & Reports"
        description="Indicadores gerenciais calculados a partir dos dados armazenados. Cada gráfico responde a uma pergunta."
        actions={
          <>
            <MultiSelect label="País" value={countries} onChange={setCountries} options={[...new Set(dataset.jobs.map((j) => j.country))].sort().map((x) => ({ value: x, label: countryName(x) }))} />
            <Segmented label="Período" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.key, label: p.label }))} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Vagas na coorte" value={k.identified} hint={`${PERIODS.find((p) => p.key === period)!.label}${countries.length ? ` · ${countries.length} país(es)` : ''}`} />
        <MetricCard label="Aderência média" value={avgScore ?? '—'} hint="0–100, regras determinísticas" />
        <MetricCard label="Bloqueadas por requisito" value={blocked} hint={c.jobs.length ? fmtPct(blocked / c.jobs.length) + ' da coorte' : '—'} tone="danger" />
        <MetricCard label="Taxa de resposta" value={fmtPct(k.responseRate)} hint={`${k.responded}/${k.submitted} enviadas`} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2" data-testid="charts">
        <ChartCard title="Funil de candidaturas" question="Em que etapa as oportunidades param de avançar?">
          <FunnelChart steps={steps} />
        </ChartCard>
        <ChartCard title="Evolução semanal" question="O ritmo de descoberta e envio está crescendo ou caindo?">
          <LineChart
            labels={tl.map((p) => fmtDate(p.weekStart, true))}
            series={[
              { name: 'Vagas descobertas', values: tl.map((p) => p.discovered) },
              { name: 'Candidaturas enviadas', values: tl.map((p) => p.submitted) },
              { name: 'Respostas', values: tl.map((p) => p.responded) },
            ]}
          />
        </ChartCard>
        <ChartCard title="Oportunidades por país" question="Quais mercados concentram oportunidades? (clique para filtrar)">
          <BarList
            data={byCountry.map((x) => ({ key: x.key, label: <CountryLabel code={x.key} />, value: x.count }))}
            selected={countries}
            onSelect={(key) => setCountries((cs) => (cs.includes(key) ? cs.filter((x) => x !== key) : [...cs, key]))}
          />
        </ChartCard>
        <ChartCard title="Oportunidades por área" question="As vagas encontradas estão alinhadas às áreas prioritárias?">
          <BarList color="var(--chart-3)" data={byArea.map((x) => ({ key: x.key, label: AREA_LABEL[x.key as JobArea], value: x.count }))} />
        </ChartCard>
        <ChartCard title="Distribuição de match scores" question="Quantas vagas têm aderência suficiente para agir (≥ 60)?">
          <ColumnChart data={hist.map((b) => ({ label: `${b.from}`, value: b.count }))} highlight={(i) => hist[i]!.from >= 60} color="var(--chart-2)" />
          <p className="mt-2 text-[11px] text-subtle">Faixas de 10 pontos. Barras destacadas: ≥ 60. Score mede aderência, não elegibilidade.</p>
        </ChartCard>
        <ChartCard title="Status das candidaturas" question="Como está distribuída a carteira atual de candidaturas?">
          <StackedBar data={[...STAGE_ORDER, 'closed' as const].map((s) => ({ key: s, label: STAGE_LABEL[s], value: stages[s], color: STAGE_COLOR[s] }))} />
        </ChartCard>
        <ChartCard title="Competências mais demandadas" question="Quais competências o mercado-alvo mais exige?">
          <BarList color="var(--chart-5)" data={skills.map((s) => ({ key: s.key, label: s.label, value: s.count, hint: `${s.count} vagas · ${s.must} como obrigatória` }))} />
        </ChartCard>
        <ChartCard title="Lacunas recorrentes" question="Quais requisitos mais frequentemente faltam ou não estão comprovados no perfil?">
          <BarList
            color="var(--chart-4)"
            data={gaps.map((g) => ({ key: g.key, label: g.label, value: g.total, hint: `${g.missing} ausente(s) · ${g.unknown} a validar` }))}
          />
          <p className="mt-2 text-[11px] text-subtle">Inclui requisitos não atendidos e desconhecidos (pendentes de validação) em vagas abertas.</p>
        </ChartCard>
      </div>

      <Card className="mt-4 flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Exportar relatório</h2>
          <p className="text-xs text-muted">Relatório executivo (Executive Summary, Top Opportunities, Performance, Strategic Intelligence) gerado a partir dos dados exibidos.</p>
        </div>
        <div className="flex gap-2">
          <Button icon={<FileDown className="size-4" />} onClick={() => download(`career-os-relatorio-${period}.md`, executiveReport(scoped, matches, period), 'text/markdown')} data-testid="export-md">
            Markdown
          </Button>
          <Button icon={<FileSpreadsheet className="size-4" />} onClick={() => download('career-os-vagas.csv', jobsToCsv({ ...scoped, jobs: c.jobs }, matches), 'text/csv')}>
            CSV
          </Button>
        </div>
      </Card>
    </div>
  );
}
