# Plano de testes

| Camada | Ferramenta | Quando |
|---|---|---|
| career-ops core | `node test-all.mjs`, `node scripts/check-syntax.mjs` | toda sync de upstream |
| career-ops web | `npm run typecheck`, `npm test`, `npm run build` | idem |
| CV visual | `npm run test:cv-visual` (Playwright) | ao mexer em templates |
| Career OS packages | `node --test` com fixtures (formato real dos arquivos do career-ops) | Fase 2+ |
| Matching 0–100 | testes de propriedade: blocker ⇒ categoria `blocked`; desconhecido ≠ atendido | Fase 2 |
| Dashboard | typecheck, lint, build, Playwright e2e + screenshots 1440px e 390px, axe a11y | Fase 3 |
Tudo agregado em `career-os/scripts/verify.sh`.
