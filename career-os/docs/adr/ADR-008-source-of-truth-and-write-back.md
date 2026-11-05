# ADR-008 — Fonte da verdade única e write-back para o career-ops
Status: aceito (2026-11-05). **Substitui** a linha "Movimentações feitas no dashboard → fonte da verdade: Career OS" do ADR-007.

## Problema
`CLAUDE.md` (regra 7) dizia que os arquivos do career-ops são a fonte da verdade e qualquer banco é derivado.
O ADR-007 dizia que as movimentações feitas no dashboard pertenciam ao Career OS. As duas regras não podiam valer juntas.

## Decisão
**Os arquivos do career-ops são a única fonte da verdade do estado das candidaturas** (`data/applications.md` + `data/status-log.tsv`).
O Career OS mantém um **diário** (journal: `applications` + `application_events`, append-only) que é:
1. **fila de comandos** — cada movimentação feita no dashboard é um evento que *deve* ser aplicado ao tracker
   pelo escritor canônico do career-ops, `set-status.mjs --row N <Estado> --on <data> --source web --note career-os:<id>`;
2. **índice derivado** — reconstruível a partir dos arquivos (`npm run radar -- --db` + `npm run sync`).

| Dado | Dono | Como chega ao outro lado |
|---|---|---|
| Estado/histórico de candidatura com equivalente no career-ops (Evaluated, Applied, Responded, Interview, Offer, Rejected, Discarded, Hired) | **career-ops** | dashboard → *push* via set-status.mjs; career-ops → *pull* para o diário |
| Etapas sem equivalente (Descoberta, Preparação, Pronta p/ revisão) | Career OS (diário) | não vão ao tracker; marcadas `not_applicable`; preservadas no diário e no export |
| Movimento de vaga sem linha no tracker (vaga só coletada) | Career OS (diário) | `not_applicable` até a vaga ser avaliada e entrar no tracker |
| Vagas coletadas (`scan-history.tsv`) | career-ops | espelho no banco (`npm run radar -- --db`), idempotente |
| Perfil (`cv.md`, `profile.yml`) + extensão privada | career-ops / `private/` | snapshot no banco (`professional_profiles.snapshot`) para quem não tem os arquivos (Vercel) |
| Favoritos | navegador | — |

## Comportamento após a adoção
- Na 1ª movimentação de uma candidatura do tracker, o dashboard a **adota**: copia o histórico existente com as datas originais
  (eventos `actor=import`, estado `external`) e anexa o novo evento (`pending`).
- **Onde o tracker está no mesmo servidor** (laptop/VPS, `CAREER_OS_DATA_SOURCE=career-ops`): write-through imediato;
  o evento vira `applied` ou `failed` (o erro é mostrado; nada é escondido).
- **Onde não está** (Vercel, `CAREER_OS_DATA_SOURCE=database`): o evento fica `pending` e a UI diz isso; `npm run sync`
  na máquina que tem os arquivos aplica os pendentes **em ordem** (para na 1ª falha daquela candidatura) e depois faz o *pull*.
- **Precedência:** pendentes do dashboard são enviados primeiro; depois disso, **o arquivo vence** — mudanças feitas pelo
  próprio career-ops entram no diário como `actor=career-ops` (estado `external`, nunca reenviadas).

## Reconstrução e exportação sem perda
- `npm run export [-- --db]` → `pipeline-export-*.jsonl` (cada candidatura com todos os eventos e estado de sync) e `.tsv`
  compatível com o status-log.
- Perda do banco: `npm run radar -- --db` recria vagas, perfil e candidaturas do tracker (com histórico do status-log);
  só se perderiam eventos *journal-only* ainda não exportados — por isso o export deve rodar com o sync.
- Perda do diário local: idem; o tracker continua íntegro porque todo evento com equivalente foi aplicado por set-status.mjs.

## Consequências
- Nenhuma escrita direta em `applications.md`: só via `set-status.mjs` (lock, validação, ledger).
- `application_events` continua imutável; o estado de sync fica em `event_sync` (RLS por dono).
- Eventos ficam preservados para usos futuros (ex.: Wave 2), sem nenhuma lógica de gamificação agora.
