# Deploy na Vercel

Arquitetura em produção:

| Parte | Onde | Projeto na Vercel |
| --- | --- | --- |
| Site (Next.js) | Vercel | `savepoint-web` → Root Directory `apps/web` |
| API (NestJS, como função serverless) | Vercel | `savepoint-api` → Root Directory `apps/api` |
| Banco | Prisma Postgres (Marketplace da Vercel) | conectado ao `savepoint-api` |
| Capas e banners | Vercel Blob | conectado ao `savepoint-api` |

O navegador só fala com o site. O site chama a API pelo servidor (variável `API_URL`).

## 1. Pré-requisitos

- Repositório no GitHub (a Vercel faz deploy automático a cada push na `main`).
- Conta na Vercel (pode entrar com o GitHub).

## 2. Projeto da API (`savepoint-api`)

1. Vercel → **Add New → Project** → importe o repositório.
2. **Root Directory:** `apps/api`. Framework: *Other* (o `apps/api/vercel.json` já define build e rotas).
3. Antes do primeiro deploy, em **Storage**:
   - **Create → Prisma Postgres** (Marketplace) e conecte ao projeto. Isso cria a `DATABASE_URL`.
   - **Create → Blob** e conecte ao projeto. Isso cria a `BLOB_READ_WRITE_TOKEN`.
4. Em **Settings → Environment Variables** (Production), adicione:
   - `JWT_SECRET` — gere um novo: `openssl rand -hex 32`. **Não reutilize o do `.env` local.**
   - `ENABLE_EXPERIMENTAL_COREPACK` = `1` — para a Vercel usar o pnpm 12 definido em `package.json`.
5. Deploy. O build roda `prisma migrate deploy`, então as tabelas são criadas sozinhas.
6. Teste: `https://<seu-projeto-api>.vercel.app/api/health` deve responder `{"ok":true}`.

> A `DATABASE_URL` precisa estar disponível também no **build** (para as migrations). Confira se a variável criada pela integração está marcada para o ambiente de build.

## 3. Popular o banco (uma única vez)

Na sua máquina, com as variáveis de produção (copie-as do painel; **não** commite):

```bash
cd apps/api
DATABASE_URL="<url de produção>" BLOB_READ_WRITE_TOKEN="<token>" pnpm db:seed
```

- Cria o catálogo, os usuários demo, as reviews e as listas.
- Em seguida o sync envia para o Blob as capas que você já tem em `storage/media` (sem consultar a Wikipedia de novo) e busca as que faltam.

⚠️ **O seed apaga todos os dados antes de inserir.** Rode só na primeira vez. Depois que houver usuários reais, nunca mais rode `db:seed` nem `db:reset` em produção. Para buscar capas novas, use só `pnpm catalog:sync`.

## 4. Projeto do site (`savepoint-web`)

1. **Add New → Project** → mesmo repositório.
2. **Root Directory:** `apps/web`. Framework: Next.js (o `apps/web/vercel.json` já define o build).
3. Variáveis (Production):
   - `API_URL` = `https://<seu-projeto-api>.vercel.app/api`
   - `ENABLE_EXPERIMENTAL_COREPACK` = `1`
4. Deploy e abra o site. Entre com `demo` / `savepoint123`.

## 5. Depois do deploy

- **API: CORS.** Não é necessário (o navegador nunca chama a API diretamente). Se um dia expor a API, defina `WEB_ORIGIN` com a URL do site.
- **Domínio próprio:** Settings → Domains no projeto do site. O HTTPS é automático (e obrigatório: o cookie de login é `secure` em produção).
- **Conta demo:** a senha aparece na home e qualquer pessoa pode alterar o perfil `demo`.
- **Capas:** são arte das publicadoras. Uso aceitável em portfólio não comercial; o plano Hobby da Vercel também é só para uso pessoal/não comercial.

## Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| Build falha no `pnpm install` | Falta `ENABLE_EXPERIMENTAL_COREPACK=1` (a Vercel tentaria outra versão do pnpm) |
| Build falha no `migrate deploy` | `DATABASE_URL` não está disponível no build |
| API responde 500 "Falha ao iniciar a API" | Veja os logs da função: geralmente `JWT_SECRET` ou `DATABASE_URL` ausentes, ou o binário do Prisma não incluído |
| Site abre mas dá "Não foi possível falar com a API" | `API_URL` errada (precisa terminar em `/api`) |
| Capas não aparecem | O sync não rodou com `BLOB_READ_WRITE_TOKEN`; rode `pnpm catalog:sync` com as variáveis de produção |
