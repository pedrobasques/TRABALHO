# Setup

Requisitos: Node ≥ 22.18 (Career OS usa type-stripping nativo; o career-ops aceita ≥ 22.13), npm, git.

## Dashboard Career OS

```bash
cd career-os
npm install
npm run check        # typecheck + 30 testes do core + build
npm start            # http://127.0.0.1:3100 (apenas loopback)
npm run test:e2e     # 13 testes Playwright; requer o servidor rodando
```

Fonte de dados: `CAREER_OS_DATA_SOURCE=auto` (padrão: career-ops se houver `data/applications.md` ou
`data/scan-history.tsv`, senão DEMO), `demo` ou `career-ops`. `CAREER_OPS_ROOT` aponta para outro checkout
(padrão `career-os/upstream/career-ops`). Testar o modo real sem dados pessoais:

```bash
CAREER_OS_DATA_SOURCE=career-ops CAREER_OPS_ROOT=$PWD/upstream/career-ops/test-fixtures/upgrade/state-v1.18 npm start
```

## career-ops (motor)

```bash
career-os/scripts/setup.sh            # core + web + build + doctor
career-os/scripts/verify.sh           # gates de qualidade (~minutos)
```

Executar a UI do career-ops (local, sem login — nunca expor):
```bash
cd career-os/upstream/career-ops/web && npm start     # http://127.0.0.1:3000
```

Onboarding (cria seus arquivos pessoais, todos gitignored): abra o Claude Code em
`career-os/upstream/career-ops/` e peça o setup — o `AGENTS.md` do career-ops conduz a conversa.
Ou manualmente: `cp config/profile.example.yml config/profile.yml`, `cp modes/_profile.template.md modes/_profile.md`,
`cp templates/portals.example.yml portals.yml`, criar `cv.md`.

⚠️ No Claude Code Cloud, esses arquivos somem quando o container é reciclado. Até a Fase 2 definir o
armazenamento privado, faça o onboarding numa máquina sua ou guarde cópia fora do Git.

Chromium no container cloud:
```bash
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux*/chrome | head -1)
```
