# Career OS

Centro de comando pessoal para gestão de carreira e candidaturas internacionais.
Baseado no projeto open source [career-ops](https://github.com/career-ops-hq/career-ops) (MIT, © Santiago Fernández de Valderrama).
Career OS não é afiliado nem endossado pelo career-ops.

```
career-os/
├── upstream/career-ops/   snapshot intocado do career-ops (v1.38.0) — ver upstream/UPSTREAM.md
├── apps/dashboard/        dashboard Next.js (9 telas, dados DEMO ou career-ops)
├── packages/core/         domínio, matching 0–100, métricas, adaptadores career-ops
├── scripts/               setup.sh · verify.sh · sync-upstream.sh
├── docs/                  documentação viva (comece por docs/STATUS.md)
└── private/               dados pessoais locais — gitignored, nunca versionado
```

Início rápido:

```bash
cd career-os
npm install
npm run build
npm start          # http://127.0.0.1:3100
```

Estado real de cada módulo: [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md). Setup completo: [`docs/SETUP.md`](docs/SETUP.md).
