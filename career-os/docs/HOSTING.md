# Hospedagem e operação contínua (análise — nada contratado)

O Claude Code Cloud é **efêmero**: não serve para hospedagem, banco ou agendamento.

| Necessidade | Opção econômica recomendada | Alternativas | Observações |
|---|---|---|---|
| Coleta agendada (Nível 1–3, zero token) | **GitHub Actions cron** em repo privado (cota gratuita de minutos) — só se dados ficarem fora do repo | VPS pequena (Oracle Free Tier / Hetzner ~€4), máquina própria + cron | Actions não deve commitar dados pessoais; precisa de storage externo |
| Deep analysis (Nível 4–5) | Claude Code interativo (assinatura) sob demanda | API Anthropic paga em batch | Automação headless com a assinatura **não** está garantida; confirmar termos antes |
| Dados privados persistentes | Supabase (Postgres + Storage, free tier) **ou** VPS com disco + backup criptografado | Google Drive privado (rclone), repo privado separado só de dados | Decidir com o usuário (BACKLOG) |
| Dashboard | Vercel/Netlify free **com auth** (apenas app Career OS) | VPS + Tailscale (sem exposição pública) | Web do career-ops só via túnel privado (ADR-005) |
| Monitoramento | logs de execução no próprio store + e-mail de falha | Sentry free | |
| Backup | dump diário criptografado para 2º destino + restore testado | | |

Recomendação preliminar: **VPS barata ou máquina própria sempre ligada + Tailscale** para rodar o career-ops completo
(é local-first por design), e app Career OS com auth para leitura no celular. Requer autorização de gasto.

## Preparação para deploy (sessão 2 — nada publicado)

- O dashboard é um app Next.js padrão (`career-os/apps/dashboard`), buildável com `npm run build` na raiz `career-os/`.
- Variáveis: `CAREER_OS_DATA_SOURCE`, `CAREER_OPS_ROOT`, `CAREER_OS_PRIVATE_DIR` (ver `.env.example`).
- **Bloqueadores antes de qualquer hospedagem:** (1) autenticação (ex.: Auth.js com um único usuário, ou acesso só via Tailscale);
  (2) fonte de dados persistente — numa hospedagem serverless não existem os arquivos do career-ops, então é preciso
  implementar `DatasetRepository` sobre Postgres/Supabase (índice derivado, ADR-002) ou rodar numa VPS com o career-ops ao lado;
  (3) remover a rota de diagnóstico ou protegê-la pela autenticação.
- Caminho recomendado (menor risco): VPS/mini-PC próprio + Tailscale + `npm start` sob systemd, career-ops no mesmo host com cron.
