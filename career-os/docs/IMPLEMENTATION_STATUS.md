# Career OS — Implementation Status

_Atualizado: 2026-11-05 (sessão 4 — operação real e consistência). Branch: `claude/sprint4-real-data` (empilhada sobre sprint3 → PR #1). Baseline: `main`._

## Sessão 4.5 — radar com coleta real (2026-11-05)
| Item | Status | Evidência |
|---|---|---|
| Coleta real | ✅ | `npm run radar:collect` (config/radar-portals.yml): 10/10 fontes responderam (Stellantis, Caterpillar, Rockwell [Workday]; BMW [SuccessFactors]; Relativity, Redwood, Divergent [Greenhouse]; Enpal [Ashby]; ANYbotics [Lever]; Gupy BR). 3.151 anúncios → 162 após filtros determinísticos do career-ops |
| Rede no container | ✅ | providers do career-ops exigem `CAREER_OPS_TRUST_PROXY_EGRESS=1` atrás do proxy; `fetch-jd.mjs` exige `NODE_USE_ENV_PROXY=1` — o pipeline aplica ambos quando há `HTTPS_PROXY` |
| Triagem A/B/C + exclusões | ✅ | `packages/core/src/ingest/triage.ts` (multilíngue) — 159 mantidas, 3 descartadas |
| Qualificação (JD) | ✅ | `radar-ingest --qualify 20`: JD via `fetch-jd.mjs` (Workday/Greenhouse/Ashby/Lever) e via provider Gupy; extração determinística (`jd-extract.ts`) → 15/20 com requisitos |
| Identidade / dedup | ✅ | id = id nativo / URL (nunca o fingerprint de conteúdo); vagas com URLs nativas distintas nunca são fundidas (3 "possíveis republicações" sinalizadas); migration 0400 troca `unique(dedupe_key)` por `unique(external_id)` |
| País primário | ✅ | primeiro local listado pelo ATS; países fora da lista não viram país prioritário |
| Matching honesto | ✅ | sem CV, requisitos ficam "desconhecidos" (não "não atendidos"); sem requisito verificável → técnico e score "n/d" (`insufficientReason` posting/profile) |
| Shortlist | ✅ | `npm run radar:shortlist` (lê do banco, mesmo motor) |
| Fluxo real no dashboard | ✅ local | banco de teste isolado: radar DE (5), detalhe com link Ashby, pipeline → Qualificada, eventos persistidos, funil 0→1 |
| Supabase/Vercel reais | ⛔ | dependem da conta do proprietário |

Testes 4.5: core **69/69** (+6 de regressão do radar) · Postgres **21/21** · e2e app **13/13** · typecheck/build OK.

## Sessão 4 — resumo comprovado
| Item | Status | Evidência |
|---|---|---|
| Fonte da verdade única (ADR-008) | ✅ | CLAUDE.md regra 7, ADR-007 e ADR-008 dizem o mesmo: arquivos do career-ops canônicos; diário = fila + índice |
| Write-back dashboard → tracker | ✅ | `set-status.mjs` real: teste core (cópia da fixture), e2e no navegador (linha do tracker + status-log `web`), `npm run sync` no fluxo em modo banco |
| Pull tracker → diário | ✅ | teste core + fluxo: `set-status.mjs --row 2 Offer` → `npm run sync` → evento `actor=career-ops`, `external` |
| Export sem perda | ✅ | `npm run export -- --db`: 6 candidaturas, 14 eventos, JSONL + TSV |
| Dataset via banco (modo Vercel) | ✅ local | dashboard com `CAREER_OS_DATA_SOURCE=database`, sem arquivos: radar, detalhe, pipeline, KPIs e analytics vindos do Postgres |
| Ingest: falha parcial | ✅ | savepoint por linha; teste: 1 linha inválida reportada, 3 gravadas |
| Banco indisponível | ✅ | erro tipado `unavailable` (teste pg) e e2e: API 503, UI recusa, sem selo "salvo", etapa inalterada |
| Isolamento entre usuários | ✅ | testes pg: leitura, escrita, histórico, `event_sync` de outro dono |
| **Coleta piloto real** | ⛔ **pendente** | `npm run pilot` executado: 2 boards públicos Greenhouse, 0 vagas, 2 falhas `network`. Causa: política de rede do ambiente recusa `boards-api.greenhouse.io` (proxy `connect_rejected`; WebFetch `ENOTFOUND`) |
| **Fluxo com vaga real** | ⛔ **pendente** | Todas as etapas validadas com a fixture **sintética** do career-ops (`state-v1.18`), não com vagas reais. Não validado: formato real das respostas dos ATS passando por scan.mjs → ingest → banco |
| Verificação de deploy | 🟡 preparada | `scripts/verify-deploy.mjs` testado contra servidores locais (protegido: PASS; sem auth: 4 FAIL) — nada publicado |
| Supabase real / Vercel | ⛔ | requer sua conta (passos em DEPLOYMENT.md) |

Testes (sessão 4): core **63/63** · dashboard **4/4** · Postgres real **21/21** (`npm run test:pg`; dentro de `npm run check` a suíte do banco aparece *skipped* por não ter URL — não é aprovação) · e2e **17/17, 0 ignorados** (app 13, auth 2, banco indisponível 1, write-through 1) · build OK.


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
