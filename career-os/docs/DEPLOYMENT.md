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
| `CAREER_OS_DATA_SOURCE` | `database` (com Supabase; vagas e perfil vêm do banco) ou `demo` (sem banco) |
| `CAREER_OS_STORE` | `auto` |

Sem banco, o pipeline mostra "Só navegador" (nada é fingido como persistido).

### 3. Supabase (opcional, para persistência real)
1. Criar projeto (Free tier) em região próxima (ex.: São Paulo).
2. Aplicar as migrations: `supabase link --project-ref <ref>` e `supabase db push` a partir de `career-os/`
   (ou colar `supabase/migrations/*.sql` em ordem no SQL Editor). **Não** aplique `supabase/tests/supabase-shim.sql`.
3. Authentication → Users → *Add user* (seu e-mail). Copie o **UUID**.
4. SQL Editor: `insert into public.app_users (id, email) values ('<UUID>', '<email>');`
5. Database → Connection string → **Transaction pooler** (porta 6543), com `?sslmode=require`.
6. **Certificado TLS do projeto:** Project Settings → Database → **SSL Configuration** → *Download certificate*
   (arquivo `.crt`, PEM público — não é segredo, mas trate como configuração).
7. Na Vercel (Production e Preview): `DATABASE_URL=<pooler>`, `CAREER_OS_OWNER_ID=<UUID>` e
   `SUPABASE_CA_CERT=<conteúdo inteiro do .crt>` — cole do `-----BEGIN CERTIFICATE-----` ao `-----END CERTIFICATE-----`,
   com as quebras de linha (aceita também `\n` literal; vários certificados concatenados são aceitos). Redeploy.
8. Conferir: Settings do dashboard → "Persistência do pipeline" = Supabase / Postgres; `/dashboard` abre sem erro.

#### TLS com o Supabase (por que `SUPABASE_CA_CERT`)
O certificado do Supabase é emitido por uma CA própria, que não está no repositório de CAs do Node → sem ela a
conexão falha com `SELF_SIGNED_CERT_IN_CHAIN`. Além disso, o node-postgres **descarta** o objeto `ssl` passado ao
`Pool` quando a URL contém `sslmode`/`sslrootcert`. Por isso `createDb` (`packages/db/src/client.ts`), quando há
`SUPABASE_CA_CERT`, remove esses parâmetros da URL e conecta com `ssl: { ca, rejectUnauthorized: true }`:
TLS obrigatório, cadeia verificada contra a CA do projeto **e** hostname verificado. Host `*.supabase.com/.co`
sem `SUPABASE_CA_CERT` é recusado com mensagem explícita (nada de `rejectUnauthorized:false`,
`NODE_TLS_REJECT_UNAUTHORIZED=0` ou conexão sem TLS). Mensagens de erro nunca incluem a URL nem o certificado.

Se, mesmo com o certificado baixado, o erro persistir no pooler, confira se o arquivo é o atual do painel (a CA
pode ser rotacionada) e, como alternativa, use a conexão direta `db.<ref>.supabase.co:5432` com o mesmo certificado.
Teste local: `TEST_TLS_DATABASE_URL`, `TEST_TLS_CA_FILE`, `TEST_TLS_OTHER_CA_FILE` → `packages/db/tests/tls.test.ts`.

### 4. Verificação pós-deploy
- Aba anônima → a URL deve pedir login da Vercel; depois do login Vercel, a tela do Career OS pede a senha.
- `GET /api/health` → `{"ok":true,"auth":"password"}`.

## O que nunca vai para o build
`next.config.ts` exclui `upstream/**`, `private/**` e `supabase/**` do file tracing; na Vercel não existem arquivos do
career-ops nem dados pessoais. O modo `career-ops` só funciona em host próprio (VPS/mini-PC) ou após o espelho no banco.

## Custos
Vercel Hobby e Supabase Free: US$ 0 dentro dos limites (Supabase pausa projetos Free inativos por 7 dias).
Ver `docs/HOSTING.md`.

## Modo banco (sessão 4) — o que roda onde
| Onde | Comando | Papel |
|---|---|---|
| Sua máquina (tem os arquivos do career-ops) | `npm run radar -- --scan --db` | coleta, normaliza, espelha vagas + perfil + candidaturas no Supabase |
| Vercel | dashboard com `CAREER_OS_DATA_SOURCE=database` | lê vagas/perfil do banco; movimentações ficam **pendentes de sincronização** |
| Sua máquina | `npm run sync -- --db` | aplica os pendentes ao tracker via `set-status.mjs` e traz mudanças do tracker |

## Verificação do deploy (antes de usar)
```bash
node scripts/verify-deploy.mjs https://<seu-projeto>.vercel.app
```
Resultado esperado: com Vercel Authentication ativa → `PASS Vercel Authentication`; sem ela → todas as verificações do login
do app em PASS. Qualquer `FAIL` em "sem exposição anônima" = não usar e corrigir antes.
