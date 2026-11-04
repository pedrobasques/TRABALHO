# Catálogo de integrações

| Integração | Situação | Como | Restrições |
|---|---|---|---|
| ATS públicos (Greenhouse, Lever, Ashby, Workday, SmartRecruiters, SuccessFactors, BambooHR…) | ✅ disponível no career-ops (não configurado) | `portals.yml` + `scan.mjs` | APIs públicas sem login |
| Gupy (BR) | ✅ provider existe (não validado) | idem | |
| Arbeitsagentur / Interamt (DE) | ✅ providers existem | idem | |
| LinkedIn | ⚠️ apenas alertas colados pelo usuário / export próprio | `linkedin-import.mjs`, UI | sem scraping (ToS) |
| Indeed | ⛔ sem API pública utilizável | alertas por e-mail (via Gmail, Fase 5) | sem scraping |
| Gmail | ⬜ plugin `gmail` existe, desligado | OAuth `gmail.readonly` | exige autorização explícita |
| Google Calendar | ⬜ hoje só `.ics` (`ics-interview.mjs`) | OAuth `calendar.readonly` primeiro | nunca criar eventos sem autorização |
| Notion / Apify / H-1B | ⬜ plugins upstream, desligados | | Apify é pago |
