# Persistência — guia prático

Arquitetura e regras de propriedade dos dados: `adr/ADR-007-persistence-and-sync.md`.

## Modos (`CAREER_OS_STORE`)
| Modo | Onde | Quando |
|---|---|---|
| `file` | `CAREER_OS_PRIVATE_DIR/pipeline.<origem>.json` | local/VPS (padrão `auto` fora da Vercel) |
| `postgres` | Supabase (`DATABASE_URL` + `CAREER_OS_OWNER_ID`) | nuvem |
| `none` | — (UI: "Só navegador") | padrão `auto` na Vercel sem banco |

## Testar contra Postgres local (sem Supabase)
```bash
sudo -u postgres /usr/lib/postgresql/16/bin/initdb -D /var/lib/postgresql/careeros-test -A trust -U postgres
```
```bash
sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/careeros-test -o '-p 54329 -k /tmp' -l /var/lib/postgresql/careeros-test/server.log start
```
```bash
cd career-os && npm run test:pg
```
O teste cria um banco descartável, aplica `supabase/tests/supabase-shim.sql` (apenas local!) + migrations e roda contrato + RLS.

## Radar
```bash
cd career-os && npm run radar
```
Flags: `--scan` (roda `scan.mjs` do career-ops; exige `portals.yml` e rede liberada para os ATS), `--db` (espelha no Supabase).
Saídas: `private/radar/latest.json`, `private/automation-runs.jsonl` (e `automation_runs` no banco com `--db`).

## Extensão do perfil (privada)
`career-os/private/profile-extension.yml` (gitignored) — o que o `profile.yml` do career-ops não expressa:
```yaml
years_experience: 0          # preencha com o valor real
current_seniority: senior
target_seniority: [senior, lead, manager]
eligibility:
  - { country: BR, status: authorized, basis: "..." }
  - { country: IT, status: in_progress, basis: "cidadania italiana em processo" }
preferences:
  countries: { IT: 1.0, BR: 0.9, DE: 0.9, ES: 0.8, NL: 0.8, US: 0.6, AU: 0.7 }
  work_modes: [onsite, hybrid, remote]
```
`in_progress` nunca é tratado como autorização no matching.
