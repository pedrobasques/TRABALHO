# Segurança e privacidade — checklist

| Item | Estado |
|---|---|
| Repositório GitHub privado | a confirmar pelo usuário nas configurações do GitHub |
| Segredos fora do Git (`.env` ignorado na raiz e no career-ops) | ✅ |
| `.env.example` sem valores | ✅ `career-os/.env.example` |
| Dados pessoais do career-ops gitignored (cv.md, profile.yml, portals.yml, data/, reports/, documents/…) | ✅ (`.gitignore` upstream, verificado com `git add -n`) |
| `career-os/private/` gitignored | ✅ |
| Web UI apenas em loopback, sem exposição pública | ✅ (padrão upstream) · ADR-005 |
| Autenticação para dashboard remoto | ⬜ Fase 6 |
| Backups com teste de restore | ⬜ Fase 6 |
| Logs de auditoria (consentimentos, envios) | ⬜ Fase 5 |
| Rate limit / respeito a ToS dos portais | ✅ upstream usa só fontes públicas sem login; manter |
| OAuth Google com escopo mínimo (gmail.readonly) | ⬜ Fase 5, com autorização |
| LGPD/GDPR: dado de terceiros (recrutadores) só local, minimizado, apagável | ⬜ política na Fase 5 |

Antes de cada commit: `git status` deve mostrar só arquivos de sistema. Em dúvida: `git check-ignore -v <arquivo>`.
