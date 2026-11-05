# Career OS — Implementation Status

_Atualizado: 2026-11-05 (sessão 3 — Cloud Foundation & Real Data). Branch: `claude/sprint3-cloud-foundation` (PR empilhado sobre o PR #1). Baseline: `main`._

Legenda: ✅ implementado e testado · 🟢 implementado (verificação manual/visual) · 🟡 parcial · 🧪 simulado (DEMO) · ⬜ planejado · ⛔ bloqueado (depende do usuário/infra)

## Módulos

| Módulo | Status | Funcionalidade real | Limitações |
|---|---|---|---|
| Matching 0–100 | ✅ | Determinístico; met/not_met/unknown; gates de autorização e idioma; confiança; nota 1–5 separada | Pesos manuais |
| Métricas / funil / KPIs / Action Center | ✅ | Coorte por período, conversões corretas | — |
| **Auth do dashboard** | ✅ | `proxy.ts` em todas as rotas; senha scrypt + cookie HMAC httpOnly 12 h; rate limit; anti open-redirect; CSRF por Sec-Fetch-Site/Origin; logout; **fail-closed na Vercel (503 sem configuração)** | Usuário único; rate limit em memória por instância |
| **Deploy Vercel** | 🟡 | `vercel.json` (monorepo), build simulado com `VERCEL=1` OK, nada de upstream/privado no bundle, guia `docs/DEPLOYMENT.md` | ⛔ **Não publicado**: requer sua conta Vercel (sem integração nesta sessão) |
| **Schema Supabase** | ✅ | 12 tabelas, FKs, checks, dedup, triggers de histórico e auditoria, 39 políticas RLS, migrações versionadas | Testado em PostgreSQL 16 local com shim de auth; ⛔ projeto Supabase real não criado |
| **PipelineStore** (memória / arquivo / Postgres) | ✅ | Adicionar, mover, histórico, sem duplicatas, eventos, sobrevive a reinício; mesma suíte de contrato nas 3 | Escrita de volta no tracker do career-ops: ⬜ |
| **API do pipeline** | ✅ | `GET/POST /api/pipeline`, `PATCH /api/pipeline/[jobId]`, `GET …/events`; adoção de candidaturas existentes com histórico | — |
| Pipeline (UI) | ✅ | Kanban/tabela agora persistentes (arquivo local ou Postgres); badge "salvo"/"navegador"; toasts de erro | Sem banco na Vercel ⇒ fallback explícito "Só navegador" |
| **Ingest do radar** | ✅ | `npm run radar [--scan] [--db]`: lê scan-history/tracker, normaliza país/senioridade/área/modalidade, dedup por URL e identidade, registra problemas de qualidade, log de execução, espelho idempotente no banco | ⛔ **Coleta piloto não executada**: a política de rede deste ambiente bloqueia os hosts de ATS (403 no proxy) |
| **Adaptador de perfil real** | ✅ | `cv.md` (layouts atual e antigo, PT/EN), `profile.yml` (authorized_in), `private/profile-extension.yml` (elegibilidade "em processo", prioridades); tudo `declarado`; desconhecidos listados; estimativas marcadas como interpretação | Sem UI de edição; perfil ainda não espelhado no banco |
| Job Radar / Detalhe | ✅ | + badges "coletada" e "dados incompletos", card de qualidade dos dados | — |
| Perfil (UI) | ✅ | + relatório de importação (fontes, desconhecidos, interpretações) | — |
| Automation Center | 🟡 | Catálogo + diagnóstico real + **execuções reais de ingestão** | Sem scheduler |
| CV Studio | 🟡 | Inalterado desde a sessão 2 | Geração: Fase 4 |
| Gmail / Calendar / envio de candidaturas | ⛔ | — | Requer autorização |

## Limitações conhecidas (verificadas)
- Linhas legadas do scan-history (≤ v1.18) não trazem empresa: a mesma vaga pode aparecer 2× (tracker + scan) porque a dedup por identidade exige empresa. Não fazemos casamento por suposição.
- Na tabela do radar em 1440px, a coluna Status pode exigir rolagem horizontal interna da tabela (sem overflow da página).

## O que realmente persiste hoje
- **Localmente / VPS:** pipeline em `career-os/private/pipeline.<origem>.json` (arquivo 0600, escrita atômica) — comprovado após reinício do servidor; logs de ingest e diagnóstico em `career-os/private/*.jsonl`.
- **Postgres:** comprovado contra PostgreSQL 16 local (dashboard → API → RLS → `application_events`). Supabase real: aguarda criação do projeto.
- **Vercel sem banco:** nada persiste no servidor; a UI declara "Só navegador".

## Testes (sessão 3)

| Suíte | Comando | Resultado |
|---|---|---|
| Core | `npm test` (workspace core) | **55/55** |
| Dashboard (auth unit) | `npm test` (workspace dashboard) | **4/4** |
| DB contra PostgreSQL 16 real | `npm run test:pg` (cluster local :54329) | **16/16** (contrato + RLS + ingest); sem `TEST_DATABASE_URL` ⇒ *skipped*, nunca falso positivo |
| Typecheck + build | `npm run check` / `VERCEL=1 next build` | OK, 19 rotas + proxy |
| E2E app (auth off, store arquivo) | `npm run test:e2e` | **13/13** (rodado 2× seguidas: idempotente) |
| E2E auth (servidor com senha) | `AUTH_BASE_URL=… AUTH_PASSWORD=… npm run test:e2e` | **2/2** (requer servidor recém-iniciado: o rate limit bloqueia após 5 erros) |
| Smoke HTTP | curl | 503 fail-closed na Vercel; 307→login; 401 API; cookie adulterado 401; open-redirect neutralizado; 403 cross-site; 400 etapa inválida |
| Varredura visual | Playwright 1440px e 390px, 3 configurações (demo / auth / career-ops+Postgres) | 28 páginas: HTTP 200, 0 erros de console, 0 overflow horizontal |

## Como executar
Ver `docs/SETUP.md`, `docs/DEPLOYMENT.md` e `docs/PERSISTENCE.md`.
