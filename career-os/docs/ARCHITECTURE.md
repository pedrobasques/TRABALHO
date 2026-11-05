# Arquitetura — Career OS

> Status: **parcialmente implementada** (sessão 2): `packages/core` e `apps/dashboard` existem; índice derivado e persistência remota ainda não. Detalhes em `IMPLEMENTATION_STATUS.md` e ADR-006.

## Princípio
Career OS = **career-ops intocado** (motor + fonte da verdade em arquivos) **+ camadas próprias** em volta.
Não há segunda fonte da verdade: tudo que o Career OS persiste é derivado dos arquivos do career-ops
ou é dado novo que o career-ops não modela (ex.: score 0–100, consentimentos, evidências).

```
                ┌──────────────────────── career-os/apps/dashboard (Fase 3) ────────────────────────┐
 Navegador ───► │ Next.js (mesma stack do web do career-ops) · auth · design system Career OS         │
                └───────────────┬───────────────────────────────────────────────┬───────────────────┘
                                │ lê/escreve via                                │ lê
                ┌───────────────▼───────────────┐               ┌───────────────▼───────────────┐
                │ packages/core (Fase 2)        │               │ packages/index (Fase 2/6)     │
                │ contratos TS + adaptadores    │──── reindex ─►│ índice derivado (SQLite→PG)   │
                │ dos arquivos do career-ops;   │               │ reconstruível a qualquer hora │
                │ matching 0–100; elegibilidade │               └───────────────────────────────┘
                └───────────────┬───────────────┘
                                │ invoca scripts (child_process) — nunca reimplementa
                ┌───────────────▼──────────────────────────────────────────────────────────────┐
                │ upstream/career-ops: scan.mjs · providers/ · liveness · dedup · modes/*.md     │
                │ generate-pdf · verify-cv-facts · tracker · set-status · weekly-digest · plugins│
                │ USER FILES (gitignored): cv.md, config/profile.yml, portals.yml, data/, reports│
                └──────────────────────────────────────────────────────────────────────────────┘
```

## Níveis de processamento (custo)
| Nível | O quê | Quem executa | Custo IA |
|---|---|---|---|
| 1 Coleta | `scan.mjs`, providers, alertas colados | Node determinístico | 0 |
| 2 Triagem | filtros de título/local/idioma, dedup, liveness, blacklist | Node determinístico (`classify-tier`, `title-keywords`) | 0 |
| 3 Matching | score 0–100 por regras + `keyword-match`/`jd-skill-gap` | Node determinístico (packages/core) | 0 |
| 4 Deep analysis | relatório A–H (`modes/oferta.md`) só para top N | Claude Code (assinatura), sob demanda | baixo/controlado |
| 5 Preparação | CV tailor, carta, respostas (`prepare-application`) | Claude Code + scripts | sob demanda |

## Decisões
Ver `adr/`. Resumo:
- ADR-001 Vendorizar snapshot do career-ops em subpasta (não submodule, não fork na raiz).
- ADR-002 Arquivos canônicos; banco só índice derivado.
- ADR-003 Score 0–100 como camada derivada sobre o 1–5 + regras de elegibilidade.
- ADR-004 Stack: Next.js/TypeScript/Tailwind — a mesma do web do career-ops (zero dependências novas de base).
- ADR-005 Nenhuma exposição pública sem auth; hospedagem decidida na Fase 6.
