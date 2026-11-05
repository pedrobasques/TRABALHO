# Career OS — Implementation Status

_Registro objetivo do estado atual. Atualizado: 2026-11-05 (sessão 2). Branch de desenvolvimento: `claude/pensive-goldberg-6cisv7`; baseline estável: `main`._

Legenda: ✅ implementado e testado · 🟢 implementado (teste manual/visual) · 🟡 parcial · 🧪 simulado (DEMO) · ⬜ planejado · ⛔ bloqueado (depende do usuário/infra)

## Módulos

| Módulo | Status | Funcionalidade real | Limitações |
|---|---|---|---|
| `packages/core` — domínio | ✅ | Tipos de vaga, requisito, perfil com proveniência, candidatura, automação, dataset | — |
| Matching 0–100 | ✅ | Determinístico; met/not_met/unknown; pesos configuráveis; gates de autorização e idioma; confiança; teto "moderada" com dados insuficientes; nota 1–5 do career-ops exibida à parte | Pesos definidos manualmente (não validados estatisticamente); sem UI de edição; sem LLM |
| Métricas / funil / KPIs | ✅ | Coorte por período, funil monotônico, conversões com denominador correto, tempo por etapa, séries semanais, histograma, competências, lacunas | — |
| Adaptador career-ops (leitura) | ✅ | `data/applications.md`, `status-log.tsv`, `scan-history.tsv` (formato atual e legado ≤v1.18), aliases de status | Somente leitura; não lê `cv.md`/`profile.yml` (perfil fica vazio no modo career-ops); vagas do tracker não têm requisitos ⇒ confiança baixa; sem dedup tracker×scan |
| Dados DEMO | 🧪 | 40 vagas, 18 candidaturas, perfil fictício — um único dataset consistente, com selo DEMO em toda a UI | Empresas fictícias, sem links |
| Command Center `/dashboard` | ✅ | KPIs por período (URL `?period=`), funil, Action Center derivado, ranking, distribuição geográfica | — |
| Job Radar `/jobs` | ✅ | Busca sem acento, 7 filtros multi-seleção + score mínimo + favoritas, 5 ordenações, paginação, tabela/cards, export CSV | Filtros não persistem na URL (exceto `q` e `country`) |
| Job Intelligence `/jobs/[id]` | ✅ | Requisito a requisito, componentes do score, explicação, estratégia por regras, elegibilidade, vagas semelhantes, favoritar, enviar ao pipeline (local) | "Candidatar no portal" desabilitado por design |
| Pipeline `/applications` | ✅ | Kanban 9 colunas (drag & drop + select acessível), tabela, busca, país, drawer com histórico, métricas | Movimentações só no navegador (localStorage) — não escrevem no career-ops |
| Analytics `/analytics` | ✅ | 8 gráficos orientados a perguntas, filtro país/período, export Markdown/CSV | Gráficos próprios (SVG) sem zoom/brush |
| Career Profile `/profile` | 🟢 | Todas as seções com proveniência, elegibilidade por país, preferências | Sem edição; sem importação do career-ops |
| CV Studio `/cv-studio` | 🟡 | Status real dos arquivos, templates lidos do career-ops, candidaturas que precisam de CV, pendências de validação, comandos reutilizados | Geração/versionamento/diff de CV: planejado (Fase 4) |
| Automation Center `/automations` | 🟡 | Catálogo honesto (nada agendado); diagnóstico real via `POST /api/diagnostics` com histórico em `career-os/private/` | Sem scheduler; nenhuma coleta é disparada pela UI |
| Settings `/settings` | 🟢 | Fonte de dados, regras de matching, integrações, privacidade, custos, reset local | Configuração somente leitura |
| Tema claro/escuro | 🟢 | Escuro padrão; claro via toggle (persistido) | — |
| Autenticação | ⬜ | — | Servidor só em 127.0.0.1; **não expor** |
| Persistência remota / cloud | ⬜ | Contrato `DatasetRepository` definido | Fase 6 |
| Gmail / Calendar | ⛔ | — | Requer autorização OAuth do usuário |
| Envio de candidaturas | ⛔ | — | Desabilitado por política |

## Testes (sessão 2)

| Suíte | Comando | Resultado |
|---|---|---|
| Core (node:test) | `npm test` (em `career-os/`) | **30/30** |
| Typecheck core + dashboard | `npm run typecheck` | 0 erros |
| Build Next.js | `npm run build` | OK, 12 rotas |
| E2E Playwright (node:test) | `npm run test:e2e` com servidor em :3100 | **13/13** |
| Modo career-ops | servidor com `CAREER_OS_DATA_SOURCE=career-ops CAREER_OPS_ROOT=upstream/career-ops/test-fixtures/upgrade/state-v1.18` | 7 rotas HTTP 200, sem selo DEMO |
| Overflow mobile 390px / erros de console | script Playwright | 0 / 0 |
| career-ops `test-all.mjs` (sem `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`) | `node test-all.mjs` | 20.233 ok, **1 falha** — teste faz DNS real de `example.com`, que o container não resolve (`getent hosts example.com` falha) |

As 4 falhas de diagnóstico de navegador da sessão 1 foram **confirmadas** como efeito da variável `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` exportada por nós: sem ela, passam.

Lint: não há ESLint configurado (Next 16 removeu `next lint`; adicionar seria nova dependência). TypeScript `strict` + `noUncheckedIndexedAccess` cobre a maior parte.

## O que é simulado
- Todo o conteúdo do modo DEMO (vagas, empresas, candidaturas, perfil). Selo "Dados DEMO" no topo de todas as telas.
- Movimentações de pipeline, favoritos e "enviar ao pipeline": reais na UI, mas **locais** (localStorage), marcadas como tal.

## Como executar / testar
Ver `docs/SETUP.md` (seção Dashboard) e `docs/TEST_PLAN.md`.
