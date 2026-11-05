# CLAUDE.md — Career OS

## O que é
Sistema pessoal de inteligência de carreira de um único usuário (engenheiro mecânico, PMO/projetos,
melhoria contínua, Power Platform/IA, supply chain automotivo; alvo Brasil + Europa + EUA + Austrália).
Construído **sobre** o career-ops (MIT), vendorizado em `upstream/career-ops/`.

## Estado atual (atualize ao fim de cada sessão)
- Sessão 1: career-ops v1.38.0 vendorizado. Sessão 2: core + dashboard (9 telas, DEMO). PR #1.
- Sessão 3 (2026-11-05): auth (fail-closed na Vercel), Supabase schema + RLS, PipelineStore persistente
  (arquivo/Postgres), ingest do radar, adaptadores cv.md/profile.yml. Branch `claude/sprint3-cloud-foundation`.
- Sessão 4 (2026-11-05): ADR-008 (fonte da verdade única + write-back), sync push/pull, export, dataset via banco
  (modo Vercel), piloto de coleta (bloqueado pela rede), verify-deploy. Branch `claude/sprint4-real-data`.
- **Fonte da verdade do estado: `docs/IMPLEMENTATION_STATUS.md`.** Deploy: `docs/DEPLOYMENT.md`. Dados: `docs/adr/ADR-008…`, `docs/PERSISTENCE.md`.
- Bloqueios externos: conta Vercel/Supabase do usuário; rede do container bloqueia hosts de ATS (coleta real só fora daqui).

## Regras invioláveis
1. **Não inventar** fatos profissionais (resultados, números, datas, cargos, certificações, vistos, idiomas).
   Distinguir: fato comprovado / declarado / interpretação / pendente de validação.
2. **Elegibilidade**: nunca assumir autorização de trabalho. Cidadania italiana = *em processo* (não concluída).
3. **Nunca enviar** candidatura, e-mail ou agendar compromisso sem autorização explícita registrada.
4. **Dados pessoais fora do Git.** Ficam nos user files ignorados do career-ops ou em `career-os/private/`.
   Nada de DHL/Stellantis confidencial em documentos externos.
5. Não contornar CAPTCHA, login, antibot ou termos de uso de portais.
6. Não editar `upstream/career-ops/` — código novo vai em `apps/`/`packages/`; patches inevitáveis em `upstream/PATCHES.md`.
7. **Arquivos do career-ops são a única fonte da verdade** (`data/applications.md` + `status-log.tsv`, `reports/`, `scan-history.tsv`).
   O banco/diário do Career OS é fila de comandos + índice derivado: movimentações do dashboard são aplicadas ao tracker
   **somente via `set-status.mjs`** (write-through ou `npm run sync`). Nunca editar `applications.md` diretamente. Ver ADR-008.
8. Nada de dado simulado sem rótulo "DEMO". Nenhum botão sem função real (ou marcado indisponível).
9. Pedir autorização antes de: gastos, exposição pública, integrações com contas pessoais, ações destrutivas.

## Comandos
```bash
cd career-os && npm install          # workspaces: packages/core + apps/dashboard
npm run check                        # typecheck + testes core + build do dashboard
npm start                            # http://127.0.0.1:3100 (login desligado localmente; obrigatório na Vercel)
npm run test:e2e                     # requer o servidor acima rodando
npm run test:pg                      # Postgres real local (docs/PERSISTENCE.md)
npm run radar -- [--scan] [--db]     # ingest/normalização do radar (+ perfil e candidaturas no banco)
npm run sync -- [--db] [--career-ops <raiz>] [--dry-run]   # diário ⇄ tracker (set-status.mjs)
npm run export -- [--db]             # export sem perda (JSONL + TSV)
npm run pilot                        # coleta piloto em fontes públicas (raiz isolada)
node scripts/verify-deploy.mjs <url> # verificação read-only do deploy protegido
node apps/dashboard/scripts/hash-password.mjs   # credenciais do login
CAREER_OS_DATA_SOURCE=demo|career-ops|auto   # fonte de dados (padrão auto)
career-os/scripts/setup.sh          # instala core + web, build, doctor
career-os/scripts/verify.sh         # syntax check + web typecheck/test/build + test-all
career-os/scripts/sync-upstream.sh <ref>   # atualiza o snapshot do career-ops
cd career-os/upstream/career-ops/web && npm start   # UI local em 127.0.0.1:3000 (sem login!)
```
No container cloud, use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`
(o caminho pode mudar; `ls /opt/pw-browsers`). **Não** a exporte ao rodar `test-all.mjs`: ela anula 4 testes de
diagnóstico de navegador (confirmado na sessão 2). A única falha remanescente do test-all no container é DNS de `example.com`.

## Mapa de documentação
`docs/IMPLEMENTATION_STATUS.md` (o que existe de fato) · `docs/STATUS.md` (sessão 1) · `docs/AUDIT.md` · `docs/ARCHITECTURE.md` ·
`docs/DATA_MODEL.md` · `docs/ROADMAP.md` · `docs/BACKLOG.md` · `docs/adr/` · `docs/SETUP.md` ·
`docs/UPSTREAM_STRATEGY.md` · `docs/SECURITY.md` · `docs/TEST_PLAN.md` · `docs/HOSTING.md` · `docs/INTEGRATIONS.md` ·
`docs/DESIGN.md` · `docs/DEPLOYMENT.md` · `docs/PERSISTENCE.md`
