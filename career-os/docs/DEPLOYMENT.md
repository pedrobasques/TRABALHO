# Deploy seguro na Vercel (+ Supabase)

> Estado (2026-11-05): **código pronto, nada publicado.** Esta sessão não tem acesso à sua conta Vercel/Supabase.
> Siga os passos abaixo; nenhum deles expõe o dashboard anonimamente.

## Camadas de proteção
1. **Vercel Authentication — All Deployments** (Settings → Deployment Protection). Exige login Vercel para *qualquer* URL,
   inclusive o domínio de produção. A documentação atual da Vercel informa que está incluído em todos os planos, inclusive Hobby
   ([Usage & Pricing](https://vercel.com/docs/deployment-protection/usage-and-pricing)); um guia mais antigo da base de conhecimento
   diz "Pro/Enterprise" — confirme no painel. *Password Protection* da Vercel é outra coisa (Pro, US$ 20/mês) e **não** é necessária.
2. **Gate próprio do app** (`src/proxy.ts`): senha (hash scrypt) + cookie de sessão assinado. Na Vercel é **obrigatório**:
   sem `CAREER_OS_PASSWORD_HASH` e `CAREER_OS_SESSION_SECRET` todas as rotas respondem **503**.
3. Banco com **RLS** (Supabase); o servidor consulta como `authenticated` com o seu UUID.

## Passo a passo

### 1. Gerar credenciais do dashboard (no seu computador)
```bash
cd career-os/apps/dashboard
```
```bash
node scripts/hash-password.mjs
```
Digite uma senha (≥ 12 caracteres). Copie as duas linhas `CAREER_OS_PASSWORD_HASH=…` e `CAREER_OS_SESSION_SECRET=…`.

### 2. Criar o projeto na Vercel
- New Project → importe `pedrobasques/TRABALHO`.
- **Root Directory:** `career-os/apps/dashboard` (o `vercel.json` já define `installCommand: cd ../.. && npm ci`).
- Framework: Next.js. Node: 22.x. Mantenha "Include files outside the root directory" ativado.
- **Antes do primeiro deploy**, em Settings → Deployment Protection: **Vercel Authentication → All Deployments**.
- Environment Variables (Production e Preview):

| Variável | Valor |
|---|---|
| `CAREER_OS_PASSWORD_HASH` | do passo 1 |
| `CAREER_OS_SESSION_SECRET` | do passo 1 |
| `CAREER_OS_DATA_SOURCE` | `demo` (até haver espelho de vagas no banco como fonte) |
| `CAREER_OS_STORE` | `auto` |

Sem banco, o pipeline mostra "Só navegador" (nada é fingido como persistido).

### 3. Supabase (opcional, para persistência real)
1. Criar projeto (Free tier) em região próxima (ex.: São Paulo).
2. Aplicar as migrations: `supabase link --project-ref <ref>` e `supabase db push` a partir de `career-os/`
   (ou colar `supabase/migrations/*.sql` em ordem no SQL Editor). **Não** aplique `supabase/tests/supabase-shim.sql`.
3. Authentication → Users → *Add user* (seu e-mail). Copie o **UUID**.
4. SQL Editor: `insert into public.app_users (id, email) values ('<UUID>', '<email>');`
5. Database → Connection string → **Transaction pooler** (porta 6543), com `?sslmode=require`.
6. Na Vercel: `DATABASE_URL=<pooler>` e `CAREER_OS_OWNER_ID=<UUID>`. Redeploy.
7. Conferir: Settings do dashboard → "Persistência do pipeline" = Supabase / Postgres.

### 4. Verificação pós-deploy
- Aba anônima → a URL deve pedir login da Vercel; depois do login Vercel, a tela do Career OS pede a senha.
- `GET /api/health` → `{"ok":true,"auth":"password"}`.

## O que nunca vai para o build
`next.config.ts` exclui `upstream/**`, `private/**` e `supabase/**` do file tracing; na Vercel não existem arquivos do
career-ops nem dados pessoais. O modo `career-ops` só funciona em host próprio (VPS/mini-PC) ou após o espelho no banco.

## Custos
Vercel Hobby e Supabase Free: US$ 0 dentro dos limites (Supabase pausa projetos Free inativos por 7 dias).
Ver `docs/HOSTING.md`.
