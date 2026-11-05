'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  CircleHelp,
  ExternalLink,
  KanbanSquare,
  Lock,
  ShieldAlert,
  Star,
  XCircle,
} from 'lucide-react';
import {
  AREA_LABEL,
  COMPONENT_LABEL,
  CONFIDENCE_LABEL,
  REQ_STATUS_LABEL,
  SENIORITY_LABEL,
  STAGE_LABEL,
  WORK_MODE_LABEL,
  countryName,
  type Job,
  type MatchResult,
  type RequirementResult,
} from '@career-os/core';
import { useStore } from '@/lib/store';
import { cn, fmtDate, fmtRelative, fmtSalary } from '@/lib/format';
import { Button, Card, CardHeader, ConfirmationDialog, DemoIndicator, InfoNote, ScoreIndicator, StatusBadge } from '@/components/ui/primitives';
import { CategoryBadge, CountryLabel, EligibilityBadge, JobStatusBadge, OpportunityCard, RecoBadge, StageBadge } from '@/components/ui/domain';
import { useToast } from '@/components/ui/toast';

const REQ_ICON = { met: CheckCircle2, not_met: XCircle, unknown: CircleHelp } as const;
const REQ_COLOR = { met: 'text-success', not_met: 'text-danger', unknown: 'text-warning' } as const;

/** Rule-based strategy text — every sentence is derived from the match result. */
function strategy(job: Job, m: MatchResult) {
  const top = [...m.components].filter((c) => c.value != null).sort((a, b) => b.value! * b.weight - a.value! * a.weight);
  const relevance = top.filter((c) => c.value! >= 70).slice(0, 3).map((c) => `${COMPONENT_LABEL[c.key]}: ${c.detail}`);
  const strengths = m.matchedRequirements.filter((r) => r.requirement.kind === 'must').map((r) => `${r.requirement.text} — ${r.reason}`);
  const gaps = m.missingRequirements.map((r) => `${r.requirement.text} (${r.requirement.kind === 'must' ? 'obrigatório' : 'desejável'}) — ${r.reason}`);
  const evidence = m.matchedRequirements
    .filter((r) => /declarado|interpretação/.test(r.reason))
    .map((r) => `${r.requirement.text}: hoje apenas declarado — anexe evidência (projeto, certificado, carta).`);
  const hasEligReq = m.unknownRequirements.some((r) => r.requirement.category === 'eligibility');
  const questions = [
    ...m.unknownRequirements.map((r) => `${r.requirement.text}: ${r.reason}`),
    ...(m.eligibilityStatus !== 'eligible' && !hasEligReq ? [`Elegibilidade: ${m.eligibilityDetail}`] : []),
    ...m.dataIssues.map((d) => `Dado inconsistente: ${d}`),
    ...(job.salary ? [] : ['Remuneração não publicada — confirmar faixa com o recrutador.']),
  ];
  const plan: string[] = [];
  switch (m.recommendation) {
    case 'prioritize':
      plan.push('Preparar candidatura completa nesta semana (CV adaptado + carta).', 'Rodar a análise A–H do career-ops para validar a leitura de regras.');
      break;
    case 'apply':
      plan.push('Candidatar-se após adaptar o CV aos requisitos obrigatórios atendidos.');
      break;
    case 'verify_eligibility':
      plan.push('Antes de investir em preparação, confirmar autorização de trabalho / patrocínio.', 'Se viável, tratar como candidatura de alta prioridade.');
      break;
    case 'consider':
      plan.push('Avaliar se as lacunas são compensáveis; considerar apenas se houver interesse estratégico.');
      break;
    case 'do_not_apply':
      plan.push('Não candidatar-se enquanto o requisito impeditivo não for resolvido.', ...m.blockers.map((b) => `Impeditivo: ${b}`));
      break;
    case 'job_closed':
      plan.push('Vaga encerrada — manter apenas como referência de mercado.');
      break;
    default:
      plan.push('Baixa prioridade — monitorar sem ação.');
  }
  return { relevance, strengths, gaps, evidence, questions, plan };
}

function List({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-subtle">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2 text-sm text-fg">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-subtle" aria-hidden />
          <span className="min-w-0">{x}</span>
        </li>
      ))}
    </ul>
  );
}

function ReqRow({ r }: { r: RequirementResult }) {
  const Icon = REQ_ICON[r.status];
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon className={cn('mt-0.5 size-4 shrink-0', REQ_COLOR[r.status])} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-fg">{r.requirement.text}</span>
          <StatusBadge tone={r.requirement.kind === 'must' ? 'accent' : 'neutral'}>{r.requirement.kind === 'must' ? 'Obrigatório' : 'Desejável'}</StatusBadge>
        </div>
        <p className="mt-0.5 text-xs text-muted">{r.reason}</p>
      </div>
      <span className={cn('shrink-0 text-xs font-medium', REQ_COLOR[r.status])}>{REQ_STATUS_LABEL[r.status]}</span>
    </li>
  );
}

export function JobDetail({ id }: { id: string }) {
  const { dataset, matches, isFavorite, toggleFavorite, addToPipeline } = useStore();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const job = dataset.jobs.find((j) => j.id === id)!;
  const m = matches.get(id)!;
  const app = dataset.applications.find((a) => a.jobId === id);
  const s = useMemo(() => strategy(job, m), [job, m]);
  const reqs = [...m.matchedRequirements, ...m.missingRequirements, ...m.unknownRequirements].sort((a, b) => a.requirement.id.localeCompare(b.requirement.id, undefined, { numeric: true }));
  const similar = useMemo(
    () =>
      dataset.jobs
        .filter((j) => j.id !== id && (j.normalizedTitle === job.normalizedTitle || j.area === job.area))
        .map((j) => ({ job: j, match: matches.get(j.id)! }))
        .sort((a, b) => Number(b.job.normalizedTitle === job.normalizedTitle) - Number(a.job.normalizedTitle === job.normalizedTitle) || b.match.overallScore - a.match.overallScore)
        .slice(0, 4),
    [dataset.jobs, id, job, matches],
  );
  const fav = isFavorite(id);

  return (
    <div className="animate-in">
      <Link href="/jobs" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Voltar ao radar
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {job.origin === 'demo' && <DemoIndicator />}
            <JobStatusBadge s={job.status} />
            <CategoryBadge c={m.category} />
            {app && <StageBadge s={app.stage} />}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{job.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="font-medium text-fg">{job.company}</span>
            <CountryLabel code={job.country} />
            {job.city && <span>{job.city}</span>}
            <span>{WORK_MODE_LABEL[job.workMode]}</span>
            <span>{SENIORITY_LABEL[job.seniority]}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<Star className={cn('size-4', fav && 'fill-warning text-warning')} />}
            aria-pressed={fav}
            onClick={() => {
              toggleFavorite(id);
              toast(fav ? 'Removida dos favoritos (local)' : 'Adicionada aos favoritos (salvo neste navegador)');
            }}
          >
            {fav ? 'Favorita' : 'Favoritar'}
          </Button>
          {app ? (
            <Link href={`/applications?open=${app.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3.5 text-sm font-medium text-fg hover:bg-surface-hover">
              <KanbanSquare className="size-4" /> No pipeline: {STAGE_LABEL[app.stage]}
            </Link>
          ) : (
            <Button variant="primary" icon={<KanbanSquare className="size-4" />} onClick={() => setConfirm(true)} disabled={job.status === 'closed'}>
              Enviar ao pipeline
            </Button>
          )}
          <Button disabled icon={<Lock className="size-4" />} title="Envio a portais externos desabilitado até configuração e autorização explícita (Fase 5)">
            Candidatar no portal
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Requisitos × perfil" subtitle={`${m.matchedRequirements.length} atendidos · ${m.missingRequirements.length} não atendidos · ${m.unknownRequirements.length} desconhecidos`} />
            <div className="px-5 pb-3">
              {reqs.length ? (
                <ul className="divide-y divide-border/70" data-testid="requirements">
                  {reqs.map((r) => (
                    <ReqRow key={r.requirement.id} r={r} />
                  ))}
                </ul>
              ) : (
                <InfoNote tone="warning" icon={<CircleDashed className="size-3.5" />}>
                  A vaga não publica requisitos estruturados. O score técnico não pôde ser calculado e a confiança foi reduzida.
                </InfoNote>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Career Strategy" subtitle="Derivada por regras explícitas a partir do matching — não é uma análise de IA." />
            <div className="grid grid-cols-1 gap-5 px-5 pb-5 md:grid-cols-2">
              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Por que é relevante</h3>
                <List items={s.relevance} empty="Nenhum componente com aderência ≥ 70." />
              </section>
              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Pontos fortes</h3>
                <List items={s.strengths} empty="Nenhum requisito obrigatório comprovadamente atendido." />
              </section>
              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Lacunas de competências</h3>
                <List items={s.gaps} empty="Nenhuma lacuna identificada." />
              </section>
              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Estratégia recomendada</h3>
                <List items={s.plan} empty="—" />
              </section>
              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Evidências necessárias</h3>
                <List items={s.evidence} empty="Nenhuma evidência adicional exigida pelos requisitos atendidos." />
              </section>
              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Questões a validar</h3>
                <List items={s.questions} empty="Nada pendente." />
              </section>
            </div>
          </Card>

          <Card>
            <CardHeader title="Descrição" />
            <p className="px-5 pb-5 text-sm leading-relaxed whitespace-pre-line text-fg/90">{job.description || 'Descrição não disponível.'}</p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5" data-testid="match-card">
            <div className="flex items-center gap-4">
              <ScoreIndicator score={m.overallScore} size="lg" blocked={m.category === 'blocked'} />
              <div className="min-w-0 space-y-1.5">
                <CategoryBadge c={m.category} />
                <div>
                  <RecoBadge r={m.recommendation} />
                </div>
                <p className="text-xs text-muted">
                  Confiança: <span className="font-medium text-fg">{CONFIDENCE_LABEL[m.confidence]}</span> ({Math.round(m.confidenceValue * 100)}%)
                </p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ['Técnico', m.technicalScore],
                ['Carreira', m.careerScore],
                ['career-ops', m.careerOpsScore == null ? null : `${m.careerOpsScore}/5`],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-lg bg-surface-2 px-2 py-2">
                  <dt className="text-[11px] text-muted">{k}</dt>
                  <dd className="tabular text-sm font-semibold text-fg">{v ?? '—'}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 space-y-2">
              {m.components.map((c) => (
                <div key={c.key} title={c.detail}>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">
                      {COMPONENT_LABEL[c.key]} <span className="text-subtle">· peso {c.weight}</span>
                    </span>
                    <span className="tabular font-medium text-fg">{c.value == null ? 'n/d' : Math.round(c.value)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    {c.value != null && <div className="h-full rounded-full bg-accent" style={{ width: `${c.value}%` }} />}
                  </div>
                </div>
              ))}
            </div>
            <details className="mt-4 text-xs text-muted">
              <summary className="cursor-pointer font-medium text-fg">Como este score foi calculado</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {m.explanation.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          </Card>

          <Card className="p-5">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="size-4 text-muted" /> Elegibilidade
            </h2>
            <EligibilityBadge e={m.eligibilityStatus} />
            <p className="mt-2 text-sm text-muted">{m.eligibilityDetail}</p>
            {m.blockers.length > 0 && (
              <ul className="mt-3 space-y-1">
                {m.blockers.map((b) => (
                  <li key={b} className="rounded-md bg-danger-soft px-2.5 py-1.5 text-xs text-danger">
                    {b}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-subtle">O score mede aderência; elegibilidade é um gate separado. Nunca assumimos autorização de trabalho sem documento.</p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Informações da vaga</h2>
            <dl className="space-y-2 text-sm">
              {[
                ['Área', AREA_LABEL[job.area]],
                ['Setor', job.sector],
                ['Localização', `${job.city ? `${job.city}, ` : ''}${countryName(job.country)}`],
                ['Remuneração', fmtSalary(job.salary)],
                ['Patrocínio de visto', job.visaSponsorship === 'offered' ? 'Oferecido' : job.visaSponsorship === 'not_offered' ? 'Não oferecido' : 'Não informado'],
                ['Publicada', job.postedAt ? `${fmtDate(job.postedAt)} (${fmtRelative(job.postedAt, dataset.asOf)})` : 'Não informada'],
                ['Descoberta', fmtDate(job.discoveredAt)],
                ['Verificada', job.verifiedAt ? fmtDate(job.verifiedAt) : 'Não verificada'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right text-fg">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Fonte</dt>
                <dd className="text-right text-fg">
                  {job.source.url ? (
                    <a href={job.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                      {job.source.name} <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span title="Dados demonstrativos não possuem link real">{job.source.name} · sem link</span>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          {similar.length > 0 && (
            <Card>
              <CardHeader title="Comparar com vagas semelhantes" subtitle="Mesmo cargo normalizado ou mesma área" />
              <div className="px-2 pb-3">
                {similar.map((r) => (
                  <OpportunityCard key={r.job.id} job={r.job} match={r.match} compact />
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <ConfirmationDialog
        open={confirm}
        title="Enviar ao pipeline?"
        description={
          <>
            A vaga entra na etapa <strong>Descoberta</strong> do seu pipeline. {dataset.origin === 'demo' ? 'Por ser modo DEMO, ' : ''}o registro fica salvo apenas neste navegador — não é uma candidatura e nada é enviado à empresa.
          </>
        }
        confirmLabel="Adicionar"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          const created = addToPipeline(id);
          toast(created ? 'Adicionada ao pipeline (local)' : 'Esta vaga já está no pipeline', created ? 'success' : 'info');
        }}
      />
    </div>
  );
}
