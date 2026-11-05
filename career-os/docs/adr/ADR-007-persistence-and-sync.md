# ADR-007 — Persistência (Supabase) e sincronização com o career-ops
Status: aceito (2026-11-05). Complementa ADR-002.

## Quem é dono de quê
| Dado | Fonte da verdade | Banco (Supabase) | Direção |
|---|---|---|---|
| Vagas coletadas (`scan-history.tsv`) | career-ops | `jobs` (espelho, `origin='career-ops'`) | career-ops → banco, via `npm run radar -- --db`, idempotente por `(owner, dedupe_key)` |
| Tracker (`applications.md`, `status-log.tsv`) | career-ops | `applications` + `application_events` *quando adotado* | career-ops → banco ao mover pela 1ª vez (histórico importado com datas, `actor='import'`) |
| Movimentações feitas no dashboard | **Career OS** | `applications`, `application_events` (append-only) | dashboard → banco. Volta ao career-ops via `set-status.mjs`: **planejado**, ainda não implementado |
| Perfil (`cv.md`, `profile.yml`) | career-ops | `professional_profiles/experiences/skills` (tabelas criadas; espelho ainda não escrito) | career-ops → banco (planejado) |
| Extensões (elegibilidade "em processo", prioridades) | `private/profile-extension.yml` | idem | — |
| Match evaluations | derivado (recalculável) | `match_evaluations` (cache por `config_version`+`profile_hash`) | planejado |
| Execuções de automação | Career OS | `automation_runs` | escrito pelo ingest |

Não existe edição concorrente do mesmo dado em dois lugares: o dashboard nunca escreve nos arquivos do career-ops,
e o career-ops nunca escreve no banco.

## Decisões
- **Supabase** (Postgres + Auth + Storage privado, plano Free): RLS nativa, migrações SQL versionadas, conexão por pooler funciona em serverless. Alternativas (Neon + auth própria, SQLite/Turso) exigiriam reconstruir RLS/Auth.
- O servidor acessa com `pg` e executa **cada operação** em transação com `SET LOCAL ROLE authenticated` + claims JWT do dono — as políticas RLS valem também no caminho servidor.
- Histórico por trigger (`application_events`) + `audit_log` genérico; usuários autenticados não podem inserir/alterar/apagar histórico.
- Dedup: `unique(owner_id, dedupe_key)` (empresa|cargo|país normalizados) e `unique(owner_id, url_key)`; uma candidatura por vaga.
- Interface `PipelineStore` com 3 implementações (memória, arquivo, Postgres) validadas pela **mesma suíte de contrato**.
- Sem banco configurado, o app diz "Só navegador" — nunca simula persistência remota.
