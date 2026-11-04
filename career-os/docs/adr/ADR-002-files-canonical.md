# ADR-002 — Arquivos do career-ops são a fonte da verdade
Status: aceito. Segue a doutrina upstream (#918). Qualquer banco (SQLite local, Postgres/Supabase na Fase 6) é índice derivado e reconstruível por `reindex`. Dados que o career-ops não modela (score 0–100, consentimentos, proveniência) ficam em arquivos próprios em `career-os/private/` com schema versionado e teste de integridade.
