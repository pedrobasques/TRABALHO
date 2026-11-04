# ADR-005 — Nenhuma exposição pública sem autenticação
Status: aceito. O web do career-ops não tem login (o bind loopback é o controle de acesso). Ele **nunca** será exposto diretamente. Acesso remoto (celular) só via: (1) túnel privado autenticado (ex.: Tailscale) para uma máquina própria, ou (2) app Career OS com auth própria. Decisão de hospedagem na Fase 6, com autorização do usuário.
