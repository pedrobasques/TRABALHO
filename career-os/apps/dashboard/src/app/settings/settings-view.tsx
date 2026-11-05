'use client';

import { useState } from 'react';
import { Database, KeyRound, Plug, RotateCcw, Scale, ShieldCheck, Wallet } from 'lucide-react';
import { COMPONENT_LABEL, DEFAULT_MATCHING_CONFIG, MIN_COVERAGE, UNKNOWN_CREDIT, type ComponentKey } from '@career-os/core';
import { useStore } from '@/lib/store';
import { Button, Card, CardHeader, ConfirmationDialog, InfoNote, PageHeader, StatusBadge, type Tone } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

const INTEGRATIONS: { name: string; status: string; tone: Tone; note: string }[] = [
  { name: 'ATS públicos (Greenhouse, Lever, Ashby, Workday, Gupy…)', status: 'Disponível no career-ops', tone: 'accent', note: 'Requer portals.yml (onboarding). APIs públicas, sem login.' },
  { name: 'LinkedIn', status: 'Somente alertas colados', tone: 'warning', note: 'Sem scraping (termos de uso). Importação de alertas pelo career-ops.' },
  { name: 'Indeed', status: 'Sem API pública', tone: 'neutral', note: 'Possível via alertas por e-mail (Gmail), após autorização.' },
  { name: 'Gmail', status: 'Bloqueado', tone: 'danger', note: 'Requer OAuth gmail.readonly autorizado por você. Nunca envia e-mails.' },
  { name: 'Google Calendar', status: 'Planejado', tone: 'neutral', note: 'Começará somente leitura; nunca cria eventos sem autorização.' },
  { name: 'Banco de dados (Supabase/Postgres)', status: 'Planejado (Fase 6)', tone: 'neutral', note: 'Índice derivado dos arquivos do career-ops (ADR-002). Nenhum serviço contratado.' },
];

export function SettingsView({ status }: { status: { active: string; setting: string; root: string; files: Record<string, boolean> } }) {
  const { dataset, localChanges, resetLocal, overlay } = useStore();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const w = DEFAULT_MATCHING_CONFIG.weights;
  const total = Object.values(w).reduce((s, x) => s + x, 0);

  return (
    <div className="animate-in">
      <PageHeader title="Settings & Integrations" description="Fonte de dados, regras de matching, integrações, privacidade e custos." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Fonte de dados" icon={<Database className="size-4" />} />
          <dl className="space-y-2 px-5 pb-5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Fonte ativa</dt>
              <dd>
                <StatusBadge tone={status.active === 'demo' ? 'warning' : 'success'}>{status.active === 'demo' ? 'Demonstração' : 'career-ops'}</StatusBadge>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">CAREER_OS_DATA_SOURCE</dt>
              <dd className="font-mono text-xs">{status.setting}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Data de referência</dt>
              <dd className="tabular">{dataset.asOf}</dd>
            </div>
            {Object.entries(status.files).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted">{k}</dt>
                <dd>{v ? <StatusBadge tone="success">presente</StatusBadge> : <StatusBadge>ausente</StatusBadge>}</dd>
              </div>
            ))}
          </dl>
          <div className="px-5 pb-5">
            <ul className="space-y-1 text-xs text-muted">
              {dataset.sourceNotes.map((n) => (
                <li key={n}>• {n}</li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-subtle">Modo auto: usa os arquivos do career-ops quando data/applications.md ou data/scan-history.tsv existem; caso contrário, demonstração. Leitura somente — o Career OS não escreve nos arquivos do career-ops.</p>
          </div>
        </Card>

        <Card id="local">
          <CardHeader title="Alterações locais" icon={<RotateCcw className="size-4" />} subtitle="Favoritos e movimentações feitas neste navegador" />
          <div className="px-5 pb-5">
            <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
              {[
                ['Favoritos', overlay.favorites.length],
                ['Adicionadas', overlay.added.length],
                ['Movidas', Object.keys(overlay.moves).length],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-lg bg-surface-2 py-2">
                  <dt className="text-[11px] text-muted">{k}</dt>
                  <dd className="tabular text-lg font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <InfoNote tone="info">Ficam apenas no localStorage deste navegador. Não são candidaturas reais e não são sincronizadas.</InfoNote>
            <Button className="mt-4" variant="danger" disabled={localChanges === 0} onClick={() => setConfirm(true)} icon={<RotateCcw className="size-4" />}>
              Descartar alterações locais
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Regras de matching" icon={<Scale className="size-4" />} subtitle={`Configuração ${DEFAULT_MATCHING_CONFIG.version} — pesos definidos manualmente, não validados estatisticamente`} />
          <div className="space-y-2 px-5 pb-4">
            {(Object.keys(w) as ComponentKey[]).map((k) => (
              <div key={k} className="flex items-center gap-3 text-xs">
                <span className="w-24 text-muted">{COMPONENT_LABEL[k]}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(w[k] / total) * 100}%` }} />
                </div>
                <span className="tabular w-10 text-right">{Math.round((w[k] / total) * 100)}%</span>
              </div>
            ))}
          </div>
          <ul className="space-y-1 px-5 pb-5 text-xs text-muted">
            <li>• Requisito desconhecido vale {UNKNOWN_CREDIT * 100}% do peso (nunca conta como atendido).</li>
            <li>• Obrigatório não atendido: −{DEFAULT_MATCHING_CONFIG.missingMustPenalty} pontos cada.</li>
            <li>• Autorização de trabalho ou idioma obrigatório não atendidos ⇒ categoria “Bloqueada”.</li>
            <li>• Menos de {MIN_COVERAGE * 100}% dos componentes avaliáveis ⇒ categoria máxima “moderada”.</li>
            <li>• Nota 1–5 do career-ops exibida à parte (escalas diferentes).</li>
            <li>• Editar: packages/core/src/matching/config.ts (UI de edição planejada).</li>
          </ul>
        </Card>

        <Card>
          <CardHeader title="Integrações" icon={<Plug className="size-4" />} />
          <ul className="divide-y divide-border px-5 pb-3">
            {INTEGRATIONS.map((i) => (
              <li key={i.name} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">{i.name}</span>
                  <StatusBadge tone={i.tone}>{i.status}</StatusBadge>
                </div>
                <p className="mt-0.5 text-xs text-muted">{i.note}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Privacidade e segurança" icon={<ShieldCheck className="size-4" />} />
          <ul className="space-y-1.5 px-5 pb-5 text-sm text-muted">
            <li>• Servidor escuta apenas em 127.0.0.1; sem autenticação ⇒ nunca expor publicamente.</li>
            <li>• Dados pessoais do career-ops são gitignored; career-os/private/ também.</li>
            <li>• Nenhuma credencial é solicitada ou armazenada por esta interface.</li>
            <li>• Cabeçalhos: X-Frame-Options DENY, noindex, no-referrer.</li>
            <li>• Envio de candidaturas e e-mails: desabilitado até autorização explícita.</li>
          </ul>
        </Card>

        <Card>
          <CardHeader title="Custos" icon={<Wallet className="size-4" />} />
          <div className="space-y-2 px-5 pb-5 text-sm text-muted">
            <p>Nenhum serviço pago contratado. Matching e analytics rodam localmente, sem custo de IA.</p>
            <p>Análise A–H do career-ops usa a sessão do Claude Code (assinatura) sob demanda. Automação sem supervisão pode exigir API paga — requer sua autorização.</p>
            <p className="flex items-center gap-1.5 text-xs">
              <KeyRound className="size-3.5" /> Variáveis previstas: career-os/.env.example (sem valores).
            </p>
          </div>
        </Card>
      </div>

      <ConfirmationDialog
        open={confirm}
        tone="danger"
        title="Descartar alterações locais?"
        description="Remove favoritos, vagas adicionadas e movimentações salvas neste navegador. Os dados de origem não são afetados."
        confirmLabel="Descartar"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          resetLocal();
          setConfirm(false);
          toast('Alterações locais descartadas');
        }}
      />
    </div>
  );
}
