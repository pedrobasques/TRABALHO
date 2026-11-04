# CLAUDE.md — Career OS

## O que é
Sistema pessoal de inteligência de carreira de um único usuário (engenheiro mecânico, PMO/projetos,
melhoria contínua, Power Platform/IA, supply chain automotivo; alvo Brasil + Europa + EUA + Austrália).
Construído **sobre** o career-ops (MIT), vendorizado em `upstream/career-ops/`.

## Estado atual (atualize ao fim de cada sessão)
- Fase 0 (auditoria) e Fase 1 (instalação) concluídas em 2026-11-04 — ver `docs/STATUS.md`.
- Nenhum código próprio do Career OS ainda (`apps/`, `packages/` vazios). Fase 2 é a próxima.

## Regras invioláveis
1. **Não inventar** fatos profissionais (resultados, números, datas, cargos, certificações, vistos, idiomas).
   Distinguir: fato comprovado / declarado / interpretação / pendente de validação.
2. **Elegibilidade**: nunca assumir autorização de trabalho. Cidadania italiana = *em processo* (não concluída).
3. **Nunca enviar** candidatura, e-mail ou agendar compromisso sem autorização explícita registrada.
4. **Dados pessoais fora do Git.** Ficam nos user files ignorados do career-ops ou em `career-os/private/`.
   Nada de DHL/Stellantis confidencial em documentos externos.
5. Não contornar CAPTCHA, login, antibot ou termos de uso de portais.
6. Não editar `upstream/career-ops/` — código novo vai em `apps/`/`packages/`; patches inevitáveis em `upstream/PATCHES.md`.
7. **Arquivos são a fonte da verdade** (doutrina do career-ops): `data/applications.md`, `reports/`, `data/pipeline.md`.
   Qualquer banco é índice derivado, reconstruível.
8. Nada de dado simulado sem rótulo "DEMO". Nenhum botão sem função real (ou marcado indisponível).
9. Pedir autorização antes de: gastos, exposição pública, integrações com contas pessoais, ações destrutivas.

## Comandos
```bash
career-os/scripts/setup.sh          # instala core + web, build, doctor
career-os/scripts/verify.sh         # syntax check + web typecheck/test/build + test-all
career-os/scripts/sync-upstream.sh <ref>   # atualiza o snapshot do career-ops
cd career-os/upstream/career-ops/web && npm start   # UI local em 127.0.0.1:3000 (sem login!)
```
No container cloud, use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`
(o caminho pode mudar; `ls /opt/pw-browsers`).

## Mapa de documentação
`docs/STATUS.md` (o que existe de fato) · `docs/AUDIT.md` · `docs/VISION.md` · `docs/ARCHITECTURE.md` ·
`docs/DATA_MODEL.md` · `docs/ROADMAP.md` · `docs/BACKLOG.md` · `docs/adr/` · `docs/SETUP.md` ·
`docs/UPSTREAM_STRATEGY.md` · `docs/SECURITY.md` · `docs/TEST_PLAN.md` · `docs/HOSTING.md` · `docs/INTEGRATIONS.md` ·
`docs/DESIGN.md`
