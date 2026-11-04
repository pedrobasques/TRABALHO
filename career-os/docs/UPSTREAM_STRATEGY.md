# Estratégia de atualização do upstream

1. `git checkout -b chore/upstream-<tag>`
2. `career-os/scripts/sync-upstream.sh <tag>` — apaga só arquivos **rastreados** do snapshot, extrai o novo, atualiza `upstream/UPSTREAM.md`. Arquivos pessoais (gitignored) e `node_modules` permanecem.
3. Ler o `CHANGELOG.md` do intervalo; checar mudanças em `DATA_CONTRACT.md` (novos user files / migrações).
4. `career-os/scripts/setup.sh && career-os/scripts/verify.sh`
5. Rodar testes dos `packages/` do Career OS (adaptadores dependem do formato dos arquivos).
6. Commit único `chore(upstream): career-ops <tag>` + PR.

Cadência sugerida: mensal, por tag de release (não `main`). Se existirem patches em `upstream/PATCHES.md`, reaplicá-los e verificar se ainda são necessários.
