'use client';

import { useState } from 'react';
import { Activity, CheckCircle2, CircleAlert, CircleX, Lock, Play, Terminal } from 'lucide-react';
import type { AutomationJob } from '@career-os/core';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/format';
import { Button, Card, CardHeader, EmptyState, InfoNote, PageHeader, Spinner, StatusBadge, type Tone } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import type { DiagnosticRun, IngestRun } from '@/lib/data.server';

const STATE: Record<AutomationJob['state'], { label: string; tone: Tone }> = {
  manual: { label: 'Manual', tone: 'accent' },
  scheduled: { label: 'Agendada', tone: 'success' },
  blocked: { label: 'Bloqueada', tone: 'danger' },
  not_configured: { label: 'Não configurada', tone: 'neutral' },
};
const LEVEL = ['', 'Coleta', 'Triagem', 'Matching', 'Deep analysis', 'Preparação'];
const ICON = { ok: CheckCircle2, warn: CircleAlert, fail: CircleX } as const;
const COLOR = { ok: 'text-success', warn: 'text-warning', fail: 'text-danger' } as const;

export function AutomationCenter({ initialRuns, ingestRuns }: { initialRuns: DiagnosticRun[]; ingestRuns: IngestRun[] }) {
  const { dataset } = useStore();
  const toast = useToast();
  const [runs, setRuns] = useState(initialRuns);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = runs[0];

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/diagnostics', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { run: DiagnosticRun; saved: boolean };
      setRuns((r) => [body.run, ...r].slice(0, 20));
      toast(body.saved ? 'Diagnóstico concluído e registrado' : 'Diagnóstico concluído (não foi possível gravar o histórico)', body.saved ? 'success' : 'info');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha desconhecida');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-in">
      <PageHeader
        title="Automation Center"
        description="Rotinas de coleta, análise e relatório. Mostra o que existe de fato: nada está agendado até haver um host persistente."
        actions={
          <Button variant="primary" onClick={run} disabled={busy} icon={busy ? <Spinner /> : <Play className="size-4" />} data-testid="run-diagnostics">
            Executar diagnóstico
          </Button>
        }
      />

      <div className="mb-4">
        <InfoNote tone="warning" icon={<Lock className="size-3.5" />}>
          Nenhuma automação recorrente está ativa. O Claude Code Cloud é efêmero; execução 24/7 depende da escolha de hospedagem (Fase 6). Coletas externas só serão ativadas após configurar fontes permitidas.
        </InfoNote>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Rotinas" icon={<Activity className="size-4" />} subtitle="Organizadas pelos 5 níveis de processamento (custo crescente)" />
          <ul className="divide-y divide-border">
            {dataset.automations.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{a.name}</span>
                    <StatusBadge tone={STATE[a.state].tone}>{STATE[a.state].label}</StatusBadge>
                    <StatusBadge>
                      N{a.level} · {LEVEL[a.level]}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-xs text-muted">{a.description}</p>
                  {a.blockedBy && <p className="mt-1 text-xs text-danger">Bloqueio: {a.blockedBy}</p>}
                  {a.command && (
                    <code className="mt-1.5 inline-flex max-w-full items-center gap-1.5 truncate rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-muted">
                      <Terminal className="size-3 shrink-0" /> {a.command}
                    </code>
                  )}
                </div>
                <div className="shrink-0 text-xs text-subtle sm:text-right">
                  Próxima execução: <span className="text-muted">{a.schedule ?? '—'}</span>
                  <br />
                  Última execução:{' '}
                  <span className="text-muted">
                    {a.id === 'ingest' && ingestRuns[0] ? new Date(ingestRuns[0].finishedAt).toLocaleString('pt-BR') : (dataset.runs.find((r) => r.jobId === a.id)?.finishedAt ?? 'nunca')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Diagnóstico do sistema"
              subtitle={latest ? `Última execução: ${new Date(latest.at).toLocaleString('pt-BR')}` : 'Ainda não executado'}
              action={latest && <StatusBadge tone={latest.summary.fail ? 'danger' : latest.summary.warn ? 'warning' : 'success'}>{latest.summary.ok} ok · {latest.summary.warn} alertas · {latest.summary.fail} falhas</StatusBadge>}
            />
            <div className="px-5 pb-5" data-testid="diagnostics">
              {error && <p className="mb-2 rounded-md bg-danger-soft px-2.5 py-1.5 text-xs text-danger">Falha ao executar: {error}</p>}
              {!latest ? (
                <EmptyState title="Sem diagnósticos" description="Verificações locais e somente leitura: Node, career-ops, arquivos de perfil, navegador e armazenamento." />
              ) : (
                <ul className="space-y-2">
                  {latest.checks.map((c) => {
                    const Icon = ICON[c.status];
                    return (
                      <li key={c.id} className="flex items-start gap-2 text-sm">
                        <Icon className={cn('mt-0.5 size-4 shrink-0', COLOR[c.status])} />
                        <div className="min-w-0">
                          <div className="text-fg">{c.label}</div>
                          <div className="text-xs text-muted">{c.detail}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
          <Card data-testid="ingest-runs">
            <CardHeader title="Execuções de ingestão do radar" subtitle="Registradas por scripts/radar-ingest.ts em career-os/private/automation-runs.jsonl" />
            <ul className="space-y-2.5 px-5 pb-5 text-xs">
              {ingestRuns.length === 0 && <li className="text-muted">Nenhuma ingestão executada. Rode <code className="font-mono">npm run radar</code>.</li>}
              {ingestRuns.map((r) => (
                <li key={r.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="tabular text-muted">{new Date(r.finishedAt).toLocaleString('pt-BR')}</span>
                    <StatusBadge tone={r.status === 'ok' ? 'success' : r.status === 'partial' ? 'warning' : 'danger'}>{r.status}</StatusBadge>
                  </div>
                  <div className="mt-0.5 text-fg">{r.summary}</div>
                  {r.errors.slice(0, 3).map((e) => (
                    <div key={e} className="mt-0.5 text-warning">! {e}</div>
                  ))}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Histórico de execuções" subtitle="Diagnósticos gravados em career-os/private/ (fora do Git)" />
            <ul className="space-y-1 px-5 pb-5 text-xs">
              {runs.length === 0 && <li className="text-muted">Nenhuma execução registrada. Execuções de coleta nunca são simuladas.</li>}
              {runs.map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <span className="tabular text-muted">{new Date(r.at).toLocaleString('pt-BR')}</span>
                  <span className="tabular">
                    <span className="text-success">{r.summary.ok}</span> / <span className="text-warning">{r.summary.warn}</span> / <span className="text-danger">{r.summary.fail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
