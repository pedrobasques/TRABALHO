'use client';

import { Award, BookOpen, Briefcase, FolderKanban, Globe2, Languages, Lock, Target, UserRound } from 'lucide-react';
import {
  AREA_LABEL,
  ELIGIBILITY_LABEL,
  PROVENANCE_LABEL,
  SENIORITY_LABEL,
  countryName,
  type JobArea,
  type Provenance,
} from '@career-os/core';
import { useStore } from '@/lib/store';
import { Button, Card, CardHeader, DemoIndicator, EmptyState, InfoNote, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { CountryLabel, ProvenanceBadge } from '@/components/ui/domain';

const PROV_ORDER: Provenance[] = ['proven', 'declared', 'interpretation', 'pending_validation'];
const ELIG_TONE = { authorized: 'success', not_authorized: 'danger', in_progress: 'warning', unknown: 'neutral' } as const;
const ELIG_TEXT = { authorized: 'Autorizado', not_authorized: 'Sem autorização', in_progress: 'Em andamento', unknown: 'Não documentado' } as const;

export function ProfileView() {
  const { dataset } = useStore();
  const p = dataset.profile;
  const facts: Provenance[] = [
    ...p.skills.map((s) => s.provenance),
    ...p.languages.map((l) => l.provenance),
    ...p.education.map((e) => e.provenance),
    ...p.experience.map((e) => e.provenance),
    ...p.achievements.map((a) => a.provenance),
    ...p.certifications.map((c) => c.provenance),
  ];
  const countries = Object.entries(p.preferences.countries).sort((a, b) => b[1] - a[1]);
  const areas = (Object.entries(p.preferences.areas) as [JobArea, number][]).sort((a, b) => b[1] - a[1]);
  const isDemo = p.origin === 'demo';

  return (
    <div className="animate-in">
      <PageHeader
        eyebrow={isDemo ? <DemoIndicator /> : 'Perfil'}
        title="Career Profile"
        description="Base de conhecimento profissional com rastreabilidade: cada fato indica se é comprovado, declarado, interpretação ou pendente de validação."
        actions={
          <Button disabled icon={<Lock className="size-4" />} title="Edição e importação do cv.md/profile.yml do career-ops chegam na Fase 2">
            Editar perfil (Fase 2)
          </Button>
        }
      />

      {isDemo && (
        <div className="mb-4">
          <InfoNote tone="warning">
            Este é um <strong>perfil demonstrativo fictício</strong>, criado para exercitar o motor de matching. Ele não é o seu currículo e nenhuma informação pessoal real foi preenchida. Fatos reais só entram após importação de documentos validados.
          </InfoNote>
        </div>
      )}

      {p.importReport && (
        <Card className="mb-4 p-5" data-testid="import-report">
          <h2 className="mb-2 text-sm font-semibold">Importação do career-ops</h2>
          <p className="text-xs text-muted">Fontes lidas: {p.importReport.sources.length ? p.importReport.sources.join(', ') : 'nenhuma'}. Tudo que vem do CV/profile.yml é tratado como <strong>declarado</strong>.</p>
          {p.importReport.unknowns.length > 0 && (
            <>
              <h3 className="mt-3 mb-1 text-xs font-semibold tracking-wide text-warning uppercase">Desconhecido / pendente</h3>
              <ul className="space-y-1 text-sm">
                {p.importReport.unknowns.map((u) => (
                  <li key={u} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-warning" />{u}</li>
                ))}
              </ul>
            </>
          )}
          {p.importReport.notes.length > 0 && (
            <>
              <h3 className="mt-3 mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Observações e interpretações</h3>
              <ul className="space-y-1 text-sm text-muted">
                {p.importReport.notes.map((n) => (
                  <li key={n} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-subtle" />{n}</li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <UserRound className="size-6" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{p.displayName}</h2>
              <p className="text-sm text-muted">{p.headline}</p>
              <p className="mt-3 text-sm text-fg/90">{p.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <StatusBadge>Experiência: {p.yearsExperience == null ? 'não documentada' : `${p.yearsExperience} anos`}</StatusBadge>
                <StatusBadge>Nível atual: {SENIORITY_LABEL[p.currentSeniority]}</StatusBadge>
                <StatusBadge tone="accent">Alvo: {p.targetSeniority.map((s) => SENIORITY_LABEL[s]).join(', ') || '—'}</StatusBadge>
              </div>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Validação dos fatos</h2>
          {facts.length === 0 ? (
            <p className="text-sm text-muted">Nenhum fato registrado.</p>
          ) : (
            <ul className="space-y-2">
              {PROV_ORDER.map((pv) => {
                const n = facts.filter((f) => f === pv).length;
                return (
                  <li key={pv} className="flex items-center gap-3">
                    <ProvenanceBadge p={pv} />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(n / facts.length) * 100}%` }} />
                    </div>
                    <span className="tabular w-6 text-right text-sm font-medium">{n}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-subtle">Só fatos “comprovados” e “declarados” contam como atendidos no matching; “pendente de validação” conta como desconhecido.</p>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Competências" icon={<Award className="size-4" />} subtitle="Nível 1–5 e origem de cada competência" />
          <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 px-5 pb-5 sm:grid-cols-2">
            {p.skills.length === 0 && <EmptyState title="Sem competências" description="Importe seu perfil para preencher." />}
            {p.skills.map((s) => (
              <div key={s.key} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-fg">{s.label}</span>
                    <ProvenanceBadge p={s.provenance} />
                  </div>
                  {s.level == null ? (
                    <div className="mt-1 text-[11px] text-subtle">nível não informado na fonte</div>
                  ) : (
                    <div className="mt-1 flex gap-0.5" aria-label={`nível ${s.level} de 5`}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= (s.level ?? 0) ? 'bg-accent' : 'bg-surface-2'}`} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Idiomas" icon={<Languages className="size-4" />} />
          <ul className="space-y-2 px-5 pb-5">
            {p.languages.length === 0 && <li className="text-sm text-muted">Nenhum idioma registrado.</li>}
            {p.languages.map((l) => (
              <li key={l.code} className="flex items-center justify-between gap-2 text-sm">
                <span>{l.label}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular font-medium">{l.level ?? '—'}</span>
                  <ProvenanceBadge p={l.provenance} />
                </span>
              </li>
            ))}
          </ul>
          <CardHeader title="Certificações" icon={<Award className="size-4" />} />
          <ul className="space-y-2 px-5 pb-5">
            {p.certifications.length === 0 && <li className="text-sm text-muted">Nenhuma certificação.</li>}
            {p.certifications.map((c) => (
              <li key={c.key} className="flex items-center justify-between text-sm">
                {c.label} <ProvenanceBadge p={c.provenance} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Experiências" icon={<Briefcase className="size-4" />} />
          <ol className="space-y-4 px-5 pb-5">
            {p.experience.length === 0 && <li className="text-sm text-muted">Nenhuma experiência registrada.</li>}
            {p.experience.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{e.role}</span>
                    <ProvenanceBadge p={e.provenance} />
                  </div>
                  <div className="text-xs text-muted">
                    {e.company} · {e.start} – {e.end ?? 'atual'}
                  </div>
                  <p className="mt-1 text-sm text-fg/90">{e.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardHeader title="Formação" icon={<BookOpen className="size-4" />} />
          <ul className="space-y-3 px-5 pb-5">
            {p.education.length === 0 && <li className="text-sm text-muted">Nenhuma formação registrada.</li>}
            {p.education.map((e) => (
              <li key={e.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{e.degree}</span>
                  <ProvenanceBadge p={e.provenance} />
                </div>
                <div className="text-xs text-muted">
                  {e.institution} · {e.status === 'completed' ? 'concluída' : e.status === 'in_progress' ? 'em andamento' : 'situação não verificada'}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Projetos e realizações" icon={<FolderKanban className="size-4" />} subtitle="Cada realização registra empresa, período, competências, evidências e status de validação" />
          <div className="space-y-3 px-5 pb-5">
            {p.achievements.length === 0 && <EmptyState title="Nenhuma realização registrada" description="Use o formato contexto → problema → ação → resultado → evidência." />}
            {p.achievements.map((a) => (
              <div key={a.id} className="rounded-lg border border-border bg-surface-2/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 text-sm text-fg">{a.description}</p>
                  <ProvenanceBadge p={a.provenance} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>{a.company}</span>
                  <span>{a.period}</span>
                  <span>Competências: {a.skills.join(', ') || '—'}</span>
                </div>
                <div className="mt-2 text-xs">
                  <span className="text-muted">Evidências: </span>
                  {a.evidence.length ? a.evidence.join('; ') : <span className="text-warning">nenhuma anexada — não usar em candidaturas até validar</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Objetivos" icon={<Target className="size-4" />} />
          <ul className="space-y-1.5 px-5 pb-5 text-sm">
            {p.goals.length === 0 && <li className="text-muted">Nenhum objetivo registrado.</li>}
            {p.goals.map((g) => (
              <li key={g} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-subtle" />
                {g}
              </li>
            ))}
          </ul>
          <CardHeader title="Áreas prioritárias" />
          <ul className="space-y-1.5 px-5 pb-5">
            {areas.map(([a, v]) => (
              <li key={a} className="flex items-center gap-2 text-xs">
                <span className="w-40 truncate text-muted">{AREA_LABEL[a]}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-info" style={{ width: `${v * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader title="Preferências geográficas e elegibilidade" icon={<Globe2 className="size-4" />} subtitle="Prioridade de cada mercado e situação documental de autorização de trabalho" />
          <div className="grid grid-cols-1 gap-2 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
            {countries.map(([code, prio]) => {
              const e = p.eligibility.find((x) => x.country === code);
              const st = e?.status ?? 'unknown';
              return (
                <div key={code} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                  <div className="min-w-0">
                    <CountryLabel code={code} className="text-sm font-medium" />
                    <div className="text-[11px] text-subtle">prioridade {Math.round(prio * 100)}%</div>
                  </div>
                  <StatusBadge tone={ELIG_TONE[st]} title={e?.basis ?? undefined}>
                    {ELIG_TEXT[st]}
                  </StatusBadge>
                </div>
              );
            })}
          </div>
          <p className="px-5 pb-5 text-[11px] text-subtle">
            “{ELIGIBILITY_LABEL.unknown}” e “Em andamento” nunca são tratados como autorização. {countryName('IT')}: cidadania em processo ≠ cidadania concluída. Legenda de origem: {PROVENANCE_LABEL.proven}, {PROVENANCE_LABEL.declared}, {PROVENANCE_LABEL.interpretation}, {PROVENANCE_LABEL.pending_validation}.
          </p>
        </Card>
      </div>
    </div>
  );
}
