# Status real do Career OS

_Última atualização: 2026-11-04 (sessão 1 — Fases 0 e 1)_

## Implementado e verificado
| Item | Evidência |
|---|---|
| career-ops v1.38.0 vendorizado sem modificações | `upstream/UPSTREAM.md`; `PATCHES.md` vazio |
| Dependências do core instaladas (`npm install`, Node 22.23.4) | `doctor`: "Dependencies installed" |
| Web UI: `npm ci`, `typecheck`, `build` | build Next.js 16 concluído, 0 erros de tipo |
| Web UI: testes unitários | 2.277 testes: 2.241 aprovados, 0 falhas, 36 ignorados |
| Web UI em execução | `npm start` em 127.0.0.1; `/`, `/pipeline`, `/analytics` retornaram HTTP 200 e foram capturadas via Playwright |
| Suíte core `test-all.mjs` (com arquivos commitados) | **20.229 aprovados, 5 falhas, 31 avisos** — ver abaixo |
| Scripts reproduzíveis | `scripts/setup.sh`, `verify.sh`, `sync-upstream.sh` (sintaxe validada; `sync-upstream.sh` **ainda não executado** de ponta a ponta) |

### As 5 falhas do `test-all` (atribuídas ao ambiente, não confirmadas individualmente)
1. `archive-posting egress guard blocked a legitimate request` — o container não resolve DNS de `example.com` (proxy de rede do Claude Cloud).
2–5. Quatro testes de diagnóstico de browser (`doctor: no browser binary…`, `…cannot load its libraries…`, `…any other launch failure…`, `the reason carries the install hint`) — os testes simulam "browser ausente", mas a variável `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` que exportamos para usar o Chromium do container sobrepõe a simulação (a saída mostra "using the configured browser at /opt/pw-browsers/…").
Próximo passo: rodar o `test-all` sem essa variável numa máquina com Chromium instalado e confirmar.

Observação: a primeira execução (antes do commit) teve ~50 falhas porque muitos testes usam `git ls-files`; **o career-ops precisa estar commitado para que sua suíte seja válida**.

## Não implementado (planejado)
Todo o código próprio do Career OS: `packages/`, `apps/dashboard`, score 0–100, armazenamento privado, integrações, hospedagem. Ver `ROADMAP.md`.

## Pendências do usuário
Ver `BACKLOG.md` (CV, datas, elegibilidade, escolha de armazenamento privado).
