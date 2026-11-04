# ADR-001 — Vendorizar o career-ops como snapshot em `career-os/upstream/career-ops`
Status: aceito (2026-11-04)

**Contexto.** O repositório TRABALHO deve abrigar outros projetos, não pode ter git aninhado, e o career-ops precisa ser atualizável.
**Opções.** (a) fork/clone na raiz — ocupa o repo inteiro; (b) git submodule — repo aninhado na prática e o upstream é público/externo ao nosso PR flow; (c) git subtree — histórico gigante (milhares de commits) e merges ruidosos; (d) **snapshot vendorizado + script de sync**.
**Decisão.** (d). Cópia byte-a-byte de um commit registrado em `upstream/UPSTREAM.md`; atualização por `scripts/sync-upstream.sh <tag>` em branch dedicada, com diff revisável e `verify.sh`.
**Consequências.** Não usamos `update-system.mjs apply`. Proibido editar o snapshot (patches em `PATCHES.md`). Dados do usuário ficam protegidos pelo `.gitignore` do próprio career-ops.
