# ADR-006 — Dashboard próprio, dataset DEMO único e overlay local
Status: aceito (2026-11-05)

**Contexto.** O web do career-ops é alpha, com identidade visual própria e acoplado ao upstream; reestilizá-lo quebraria sincronizações (ADR-001).

**Decisões.**
1. `apps/dashboard` é um app Next.js 16 separado, na mesma stack do upstream (ADR-004), consumindo `packages/core` via npm workspaces (`transpilePackages`). O core é TypeScript puro com imports `.ts` (roda em Node ≥22.18 por type-stripping, sem build).
2. **Sem biblioteca de gráficos.** Os 5 tipos necessários (barras, funil, linha, colunas, empilhada) são componentes SVG/HTML de ~250 linhas: zero dependências, temáveis por tokens CSS, acessíveis (tabela sr-only, `role=img`).
3. **Um único dataset DEMO** (`packages/core/src/data/demo`), com data de referência fixa (2026-11-01). Todas as telas derivam números do mesmo objeto ⇒ consistência entre KPIs, funil, pipeline e analytics, verificada por teste.
4. **Matching no cliente**: o servidor entrega o `Dataset`; o cliente calcula `matchAll` (puro, determinístico). Adequado para centenas de vagas; para milhares, mover para o servidor/índice (Fase 6).
5. **Overlay local**: favoritos, "enviar ao pipeline" e movimentações vivem em `localStorage`, rotulados como locais. O dashboard **nunca escreve** nos arquivos do career-ops; escrita futura passará por `set-status.mjs` (`ApplicationWriter`).
6. Fonte de dados por `CAREER_OS_DATA_SOURCE=demo|career-ops|auto`.

**Consequências.** Sem custo de IA para navegação; UI independente do upstream; troca de fonte sem mudar componentes. Overlay local não sincroniza entre dispositivos (aceitável até a Fase 6).
