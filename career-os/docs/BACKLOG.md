# Pendências

## Exigem o usuário
- [ ] Confirmar formação (status/datas PUC Minas, MBA USP), cargos e datas da carreira.
- [ ] Fornecer CV atual (para `cv.md`) — **não** commitar; fica gitignored.
- [ ] Escolher armazenamento privado persistente (ver HOSTING.md §Dados privados).
- [ ] Idiomas e níveis comprovados (certificados?).
- [ ] Status documental de elegibilidade por país (IT em processo; demais?).
- [ ] Faixa salarial desejada por região.

## Técnicas
- [ ] Validar providers relevantes: Gupy (BR), Workday/SuccessFactors de montadoras/indústria, Arbeitsagentur (DE), fontes IT/ES/NL/BE/UK/AU.
- [ ] Avaliar se `update-system.mjs check` funciona no layout vendorizado (só leitura).
- [ ] Playwright Chromium: no container usa `/opt/pw-browsers`; em máquina própria rodar `npx playwright install chromium`.
- [ ] Executar testes visuais de CV (`npm run test:cv-visual`) — não executado na Fase 1.
