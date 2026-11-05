'use client';

import Link from 'next/link';
import { CheckCircle2, CircleDashed, FileCheck2, FileText, FileWarning, Lock, Terminal } from 'lucide-react';
import { STAGE_LABEL } from '@career-os/core';
import { useStore } from '@/lib/store';
import { Button, Card, CardHeader, EmptyState, InfoNote, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { StageBadge } from '@/components/ui/domain';

/** career-ops capabilities reused as-is (no reimplementation). Commands are real. */
const UPSTREAM_TOOLS = [
  { name: 'Gerar PDF ATS do CV', cmd: 'node generate-pdf.mjs', desc: 'HTML → PDF via Playwright, templates ATS-safe.' },
  { name: 'Verificar fatos do CV', cmd: 'node verify-cv-facts.mjs', desc: 'Confere o CV adaptado contra cv.md e config/cv-facts.json (nada inventado).' },
  { name: 'Checagem ATS', cmd: 'node verify-ats.mjs', desc: 'Valida estrutura e legibilidade para ATS.' },
  { name: 'Carta de apresentação', cmd: 'node generate-cover-letter.mjs --payload …', desc: 'Gera carta a partir de payload revisado.' },
  { name: 'Preparar candidatura', cmd: 'node prepare-application.mjs', desc: 'Monta pacote para revisão humana. Nunca envia.' },
  { name: 'Sincronia CV × perfil', cmd: 'node cv-sync-check.mjs', desc: 'Detecta divergências entre cv.md e o perfil.' },
];

export function CvStudio({ templates, files }: { templates: string[]; files: { cv: boolean; profile: boolean; applications: boolean; scanHistory: boolean } }) {
  const { dataset, matches } = useStore();
  const jobById = new Map(dataset.jobs.map((j) => [j.id, j]));
  const needing = dataset.applications.filter((a) => a.stage === 'preparing' || a.stage === 'ready_for_review');
  const pending = [
    ...dataset.profile.skills.filter((s) => s.provenance === 'pending_validation').map((s) => `Competência: ${s.label}`),
    ...dataset.profile.education.filter((e) => e.provenance === 'pending_validation').map((e) => `Formação: ${e.degree}`),
    ...dataset.profile.certifications.filter((c) => c.provenance === 'pending_validation').map((c) => `Certificação: ${c.label}`),
    ...dataset.profile.achievements.filter((a) => a.provenance === 'pending_validation' || a.evidence.length === 0).map((a) => `Realização sem evidência: ${a.description.slice(0, 60)}…`),
  ];

  return (
    <div className="animate-in">
      <PageHeader
        title="CV Studio"
        description="Gestão de currículos sobre o motor do career-ops. Nenhum currículo é gerado sem o seu documento validado."
        actions={
          <Button disabled icon={<Lock className="size-4" />} title="Requer cv.md validado e integração com generate-pdf.mjs (Fase 4)">
            Gerar CV adaptado
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Currículo mestre" icon={<FileText className="size-4" />} subtitle="career-ops: cv.md (gitignored, nunca versionado)" />
          <div className="px-5 pb-5">
            {files.cv ? (
              <InfoNote tone="success" icon={<CheckCircle2 className="size-3.5" />}>
                cv.md encontrado no career-ops. A leitura detalhada pelo Career OS chega na Fase 2 (parser com proveniência por bullet).
              </InfoNote>
            ) : (
              <EmptyState
                icon={<FileWarning className="size-5" />}
                title="Nenhum currículo mestre importado"
                description="Crie cv.md pelo onboarding do career-ops (Fase 1.5). Este painel não gera um currículo a partir de dados não validados."
              />
            )}
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {[
                ['cv.md', files.cv],
                ['config/profile.yml', files.profile],
                ['data/applications.md', files.applications],
                ['data/scan-history.tsv', files.scanHistory],
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-2">
                  {v ? <CheckCircle2 className="size-3.5 text-success" /> : <CircleDashed className="size-3.5 text-subtle" />}
                  <span className="truncate font-mono text-[11px]">{k as string}</span>
                </div>
              ))}
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader title="Pendências de validação" icon={<FileWarning className="size-4" />} subtitle="Itens que não podem entrar em CVs até serem comprovados" />
          <ul className="max-h-64 space-y-1.5 overflow-y-auto px-5 pb-5 text-sm">
            {pending.length === 0 && <li className="text-muted">Nenhuma pendência.</li>}
            {pending.map((x) => (
              <li key={x} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-warning" />
                <span className="min-w-0">{x}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Candidaturas que precisam de CV adaptado" subtitle="Derivado do pipeline: etapas Preparação e Pronta para revisão" />
          <ul className="divide-y divide-border px-5 pb-3">
            {needing.length === 0 && <li className="py-6 text-center text-sm text-muted">Nenhuma candidatura em preparação.</li>}
            {needing.map((a) => {
              const j = jobById.get(a.jobId)!;
              const m = matches.get(a.jobId)!;
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/jobs/${j.id}`} className="text-sm font-medium text-fg hover:text-accent">
                      {j.title}
                    </Link>
                    <div className="text-xs text-muted">
                      {j.company} · {m.matchedRequirements.length} requisitos para destacar · {m.missingRequirements.length + m.unknownRequirements.length} a tratar
                    </div>
                  </div>
                  <StageBadge s={a.stage} />
                  <StatusBadge tone="neutral" title="Versões de CV serão registradas na Fase 4">sem versão</StatusBadge>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Templates disponíveis" icon={<FileCheck2 className="size-4" />} subtitle="Lidos do career-ops (templates/)" />
          <ul className="flex flex-wrap gap-1.5 px-5 pb-5">
            {templates.length === 0 && <li className="text-sm text-muted">career-ops não encontrado.</li>}
            {templates.map((t) => (
              <li key={t}>
                <StatusBadge>{t.replace(/^(cv|resume)-template\.?/, '').replace(/\.(html|tex)$/, (m) => ` ${m}`) || 'default'}</StatusBadge>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader title="Ferramentas do career-ops reutilizadas" icon={<Terminal className="size-4" />} subtitle="Executadas no terminal, em career-os/upstream/career-ops. Integração por botão: Fase 4." />
          <div className="grid grid-cols-1 gap-2 px-5 pb-5 md:grid-cols-2 xl:grid-cols-3">
            {UPSTREAM_TOOLS.map((t) => (
              <div key={t.cmd} className="rounded-lg border border-border p-3">
                <div className="text-sm font-medium">{t.name}</div>
                <code className="mt-1 block truncate rounded bg-surface-2 px-2 py-1 font-mono text-[11px] text-muted">{t.cmd}</code>
                <p className="mt-1.5 text-xs text-muted">{t.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <p className="mt-4 text-xs text-subtle">
        Etapas consideradas: {STAGE_LABEL.preparing} e {STAGE_LABEL.ready_for_review}. Histórico de versões e comparação original × adaptado: planejado (Fase 4).
      </p>
    </div>
  );
}
