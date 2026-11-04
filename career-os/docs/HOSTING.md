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
