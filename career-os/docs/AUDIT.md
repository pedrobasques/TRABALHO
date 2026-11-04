# Fase 0 — Auditoria (2026-11-04)

## Repositório TRABALHO
- Estado encontrado: **vazio** — branch `claude/pensive-goldberg-6cisv7` sem nenhum commit, sem arquivos. Nada a preservar.
- Decisão: Career OS em `career-os/`; raiz contém só README, CLAUDE.md e `.gitignore` de proteção.

## career-ops (upstream)
| Item | Achado |
|---|---|
| Versão | 1.38.0 (web 0.16.0), commit `35b7c53` de 2026-11-04 |
| Licença | MIT; marca regida por `TRADEMARK.md` (nome "career-ops" não pode nomear produto derivado → usamos "Career OS", sem "powered by") |
| Runtime | Node ≥22.13; scripts ESM `.mjs` na raiz (layout plano **intencional** — paths estáveis) |
| Deps core | `dotenv`, `js-yaml`, `playwright` 1.64.1, `undici`, `@google/generative-ai` (sem lockfile na raiz) |
| Web UI | Next.js 16 + React 19 + Tailwind 4 + TypeScript 7 + lucide; lê os **mesmos arquivos** do CLI; bind loopback, **sem login** |
| TUI | Go (`dashboard/`), opcional |
| Cérebro | Prompts Markdown em `modes/` (`_shared.md` scoring 1–5, `oferta.md` relatório A–H), executados pelo Claude Code/Codex/etc. |
| Persistência | Markdown/TSV/YAML canônicos; SQLite só como índice derivado (doutrina #918) |
| Fronteira | `DATA_CONTRACT.md`: system files vs user files (estes gitignored) |
| Testes | `test-all.mjs` (milhares de checks), web `node --test` (2.277), Playwright visual de CV |
| Tamanho | ~3.100 arquivos, ~54 MB (inclui READMEs em 18 idiomas, assets) |

## Funcionalidades já existentes × requisitos (reaproveitar, não reimplementar)
| Requisito Career OS | Já existe no career-ops | Lacuna |
|---|---|---|
| A. Descoberta de vagas | `scan.mjs` + 131 `providers/` (Greenhouse, Lever, Ashby, Workday, SmartRecruiters, SuccessFactors, **Gupy**, Arbeitsagentur, Interamt…), `scan-ats-full.mjs`, import de alertas LinkedIn colados, histórico `scan-history.tsv`, `portal-health.tsv` | Sem scraping de LinkedIn/Indeed (correto — ToS); cobertura Brasil/Itália/Austrália a validar; sem agendador 24/7 |
| Dedup, republicação, encerradas, suspeitas | `dedup-tracker.mjs`, `detect-reposts.mjs`, `fingerprint-core.mjs`, `check-liveness.mjs`, `close-stale.mjs`, sinais de legitimidade em `_shared.md` | — |
| Normalização de títulos | `title-keywords.mjs`, `role-matcher.mjs`, `classify-tier.mjs` | Taxonomia específica (PMO/Industrial/Ind. 4.0) a configurar em `portals.yml`/profile |
| B. Matching | Score **1–5** + blocos A–H, archetypes, gates de legitimidade, `keyword-match.mjs`, `jd-skill-gap.mjs`, `jd-years.mjs`, `sponsor-check.mjs` (H-1B), triagem two-pass, `evaluation-cache.mjs` | Score **0–100** transparente e configurável, categoria "Bloqueada", confiança explícita, gate duro de autorização de trabalho UE/AU/BR |
| C. Knowledge base | `cv.md`, `data/career-profile.yml` (source-backed), `intake.mjs`, `interview-prep/story-bank.md`, `story-provenance-check.mjs`, `article-digest.md` | Taxonomia fato/declarado/interpretação/pendente; armazenamento privado persistente fora do container |
| D. CV Studio | `generate-pdf.mjs` (ATS), LaTeX, `cv-templates.mjs`, `generate-cover-letter.mjs`, `verify-cv-facts.mjs`, `verify-ats.mjs`, CV Studio na web, `application-answers.mjs`, i18n de modes (pt, it, de, es…) | Histórico/diff de versões com proveniência por bullet |
| E. Automação de candidatura | `prepare-application.mjs`, `ats-payload.mjs`, Apply com prefill na web, regra **nunca submete** | Consentimento registrado, limite 10/semana, evidências — a construir em cima |
| F. Gmail/Calendar | plugin `gmail` (off), `reply-watch.mjs`, `reply-matcher.mjs`, `invite-match.mjs`, `ics-interview.mjs`, `followup-cadence.mjs` | OAuth persistente e escopos mínimos |
| G. Analytics | `stats.mjs`, `funnel-velocity.mjs`, `analyze-patterns.mjs`, `weekly-digest.mjs`, `rejection-latency.mjs`, página Analytics (funil + Sankey) | Relatório executivo no formato pedido; inteligência estratégica por país |
| H. Dashboard | Web UI completa (Today, Explore, Pipeline, Follow-ups, Portals, Analytics, CV, Documents, Config, Scheduled scans) | Identidade visual própria (atual é "warm/editorial" do career-ops), 0–100, Automation Center, auth remota |

## Incompatibilidades e riscos
1. **Updater upstream × monorepo**: `update-system.mjs` usa `git checkout` assumindo que o career-ops é a raiz git. → Substituído por `scripts/sync-upstream.sh` (snapshot).
2. **Score 1–5 × 0–100**: não alterar o core; o 0–100 será uma camada derivada (ADR-003).
3. **Web UI sem autenticação** — não pode ser exposta à internet (ADR-005).
4. **Container efêmero**: dados pessoais criados aqui se perdem; e não podem ir para o Git. → Fase 2 define armazenamento privado.
5. **Execução de IA**: modes rodam via Claude Code (assinatura) interativamente; automação 24/7 headless exigiria API paga ou execução local agendada. A confirmar antes de prometer.
6. **Ritmo do upstream**: projeto muito ativo (CHANGELOG de 470 KB); sincronizar por tags, não por `main`.
7. **Tamanho do vendoring** (~54 MB): aceitável; manter sem `node_modules`.
