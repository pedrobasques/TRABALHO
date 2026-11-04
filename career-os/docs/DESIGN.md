# Estratégia visual

O web do career-ops tem identidade "editorial/warm" (serif Instrument, laranja, shaders) e é **alpha**.
Não vamos reestilizá-lo in-place (quebraria a sincronização com upstream).

Plano: `apps/dashboard` próprio, mesma stack, com design system Career OS:
- Tokens: neutros frios (zinc/slate), 1 cor de acento, semânticas (sucesso/alerta/bloqueio); dark-first com light opcional; Inter; escala 4px.
- Componentes: Sidebar, KPI card, ScoreBadge 0–100 + categoria, DataTable (filtro/ordenação), Kanban, Chart wrapper, EmptyState/ErrorState/Skeleton, DemoBadge obrigatório para dado simulado.
- Telas 01–09 conforme o prompt mestre; cada ação chama um script/API real do career-ops ou aparece desabilitada com tooltip "indisponível".
- O web do career-ops continua disponível como "modo avançado" local para fluxos ainda não portados (Apply, CV Studio).
