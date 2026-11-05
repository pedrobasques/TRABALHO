# Roadmap — Career OS

Legenda: ✅ concluído e verificado · 🟡 em andamento · ⬜ planejado

| Fase | Entrega | Critério objetivo de conclusão | Status |
|---|---|---|---|
| 0 | Auditoria | `docs/AUDIT.md` com versão, licença, deps, gaps, riscos | ✅ |
| 1 | Instalação funcional do career-ops | `setup.sh` reproduz; doctor sem erro de sistema; web typecheck+build+tests verdes; `test-all` executado e resultado documentado | ✅ (ver STATUS.md) |
| 1.5 | **Onboarding real do usuário** | `cv.md`, `config/profile.yml`, `modes/_profile.md`, `portals.yml` preenchidos com fatos validados pelo usuário; armazenamento privado escolhido; `doctor` = 0 issues | ⬜ próxima |
| 2 | Foundation | `packages/core` com contratos TS + parsers dos arquivos do career-ops (testes com fixtures do upstream); score 0–100 com testes de gates; design tokens; estratégia de dados privados implementada | 🟡 core, matching, parsers e tokens prontos; falta leitura de `cv.md`/`profile.yml` e armazenamento privado |
| 3 | MVP visual | `apps/dashboard`: Command Center, Radar, Job Intelligence, Pipeline (kanban+tabela), Perfil, Relatórios — lendo dados reais (ou DEMO rotulado); screenshots desktop+mobile; e2e | ✅ (sessão 2) — auditoria Lighthouse ainda não executada |
| 4 | Inteligência | gaps recorrentes, CV por vaga com proveniência e diff, recomendação | ⬜ |
| 5 | Integrações | fontes BR/UE/AU configuradas e validadas; Gmail read-only (plugin) com OAuth mínimo; 1 candidatura real preparada e **não enviada**; piloto ≤10/semana | ⬜ |
| 6 | Produção | hospedagem escolhida e autorizada; auth; backups testados (restore); monitoramento; acesso mobile | ⬜ |
