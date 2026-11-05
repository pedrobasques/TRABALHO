# ADR-007 — Persistência (Supabase) e sincronização com o career-ops
Status: aceito (2026-11-05), **parcialmente substituído pelo ADR-008**: a propriedade das movimentações do dashboard e a direção da sincronização valem como descritas no ADR-008 (arquivos do career-ops são a única fonte da verdade; o diário é fila + índice).

## Quem é dono de quê
| Dado | Fonte da verdade | Banco (Supabase) | Direção |
|---|---|---|---|
| Vagas coletadas (`scan-history.tsv`) | career-ops | `jobs` (espelho, `origin='career-ops'`) | career-ops → banco, via `npm run radar -- --db`, idempotente por `(owner, dedupe_key)` |
| Tracker (`applications.md`, `status-log.tsv`) | career-ops | `applications` + `application_events` *quando adotado* | career-ops → banco ao mover pela 1ª vez (histórico importado com datas, `actor='import'`) |
| Movimentações feitas no dashboard | **career-ops** (ADR-008) | `applications`, `application_events` (diário append-only) + `event_sync` | dashboard → diário → tracker via `set-status.mjs` (write-through ou `npm run sync`) — **implementado na sessão 4** |
| Perfil (`cv.md`, `profile.yml`) | career-ops | `professional_profiles` (+ `snapshot`), `experiences`, `skills` | career-ops → banco via `npm run radar -- --db` — **implementado na sessão 4** |
| Extensões (elegibilidade "em processo", prioridades) | `private/profile-extension.yml` | idem | — |
| Match evaluations | derivado (recalculável) | `match_evaluations` (cache por `config_version`+`profile_hash`) | planejado |
| Execuções de automação | Career OS | `automation_runs` | escrito pelo ingest |

O dashboard só altera o tracker através de `set-status.mjs` (escritor canônico, com lock); o career-ops nunca escreve no banco — suas mudanças chegam pelo *pull* de `npm run sync`.

## Decisões
- **Supabase** (Postgres + Auth + Storage privado, plano Free): RLS nativa, migrações SQL versionadas, conexão por pooler funciona em serverless. Alternativas (Neon + auth própria, SQLite/Turso) exigiriam reconstruir RLS/Auth.
- O servidor acessa com `pg` e executa **cada operação** em transação com `SET LOCAL ROLE authenticated` + claims JWT do dono — as políticas RLS valem também no caminho servidor.
- Histórico por trigger (`application_events`) + `audit_log` genérico; usuários autenticados não podem inserir/alterar/apagar histórico.
- Dedup: `unique(owner_id, dedupe_key)` (empresa|cargo|país normalizados) e `unique(owner_id, url_key)`; uma candidatura por vaga.
- Interface `PipelineStore` com 3 implementações (memória, arquivo, Postgres) validadas pela **mesma suíte de contrato**.
- Sem banco configurado, o app diz "Só navegador" — nunca simula persistência remota.
