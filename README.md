# 🎮 Savepoint

**Seu diário de jogos.** Registre o que jogou, dê nota, escreva reviews, organize o backlog, monte listas e descubra jogos pelo que seus amigos estão jogando — na linha de Letterboxd (filmes) e Skoob (livros), mas para games.

> Projeto de portfólio. Monorepo com **Turborepo + pnpm**, **Next.js 15** (App Router) e **NestJS 11 + Fastify**, **PostgreSQL + Prisma**.

## Funcionalidades

| Área | O que tem |
| --- | --- |
| **Estante** | 7 status (Quero jogar, Jogando, Pausado, Zerado, 100%, Abandonado, Sem fim), nota de ½ a 5 ★, like, plataforma, horas |
| **Diário** | Cada sessão/zerada vira um registro com data, plataforma, horas, replay e review (com aviso de spoiler) |
| **Perfil** | Top 4 favoritos, contadores estilo HUD, barra da estante, histograma de notas, gêneros e plataformas favoritas |
| **Social** | Seguir pessoas, feed de atividade, curtir reviews, "quem você segue jogou isto" |
| **Listas** | Listas livres ou ranqueadas, editor com busca e reordenação |
| **Catálogo** | Próprio e colaborativo: qualquer pessoa cadastra jogos; importação opcional do IGDB |

## Arquitetura

```
savepoint/
├─ apps/
│  ├─ api/        NestJS + Fastify + Prisma (REST em /api)
│  └─ web/        Next.js (Server Components + Server Actions)
└─ packages/
   └─ shared/     Schemas Zod, enums e tipos — o contrato entre front e back
```

**Decisões principais**

- **Contrato compartilhado.** Os mesmos schemas Zod validam o formulário no Next e o body na API (`ZodPipe`). Os tipos de resposta também vivem em `@savepoint/shared`.
- **Next como BFF.** O navegador nunca fala com a API: Server Components buscam dados e Server Actions fazem mutações. O JWT fica num cookie `httpOnly`, fora do alcance de JavaScript (mitiga XSS) e sem precisar de CORS.
- **Catálogo independente de terceiros.** O banco local é a fonte da verdade:
  1. **Seed curado** com 40 jogos (incluindo indies brasileiros);
  2. **Cadastro colaborativo** (estilo Skoob);
  3. **Providers externos opcionais** (`CatalogProvider`). O IGDB vem implementado; importar **copia** o jogo para o banco. Sem credenciais, tudo funciona.
- **Imagens locais.** Capas e banners são baixados de fontes abertas (Wikipedia/Wikidata/Steam) e servidos pelo próprio app.
- **Capas procedurais.** Jogos sem imagem recebem uma "box art" gerada a partir do slug (cores, padrão, tipografia), então o app fica bonito sem hotlink de imagens.
- **Estatísticas desnormalizadas.** `ratingAvg`, `playerCount` etc. ficam na tabela `Game` (atualizados pelo `StatsService`), permitindo ordenar por nota/popularidade sem agregações pesadas.

### Modelo de dados

- `UserGame` — a estante: estado atual de um jogo para um usuário (status, nota, like, Top 4, horas).
- `LogEntry` — o diário: cada registro (permite rejogar e várias reviews do mesmo jogo).
- `Game`, `Genre`, `Platform`, `GameList`/`ListItem`, `Follow`, `ReviewLike`.

## Rodando localmente

Pré-requisitos: Node 20+, pnpm, Docker.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # troque o JWT_SECRET
cp apps/web/.env.example apps/web/.env.local

pnpm db:up          # Postgres em localhost:5433 (docker compose)
pnpm db:migrate     # aplica as migrations
pnpm db:seed        # catálogo + usuários de demonstração

pnpm dev            # web em :3000, API em :3333
```

Entre com **`demo` / `savepoint123`** (ou `ana`, `bruno`, `carol`, `davi`, `elis`).

### Capas e banners reais

`pnpm db:seed` já busca as imagens automaticamente — **sem chave de API**. Para rodar de novo:

```bash
pnpm catalog:sync          # só jogos sem capa/banner
pnpm catalog:sync --force  # refaz tudo
```

Como funciona (`apps/api/src/catalog`):

1. **Wikipedia** encontra a página do jogo (título + ano: não confunde *Resident Evil 4* de 2005 com o remake de 2023, nem *Hades* o jogo com o deus).
2. **Wikidata** confirma que é um jogo e fornece o ID da Steam.
3. **Steam** fornece capa vertical em alta (600×900@2x) e banner (`library_hero`), tentando vários CDNs.
4. Jogos fora da Steam (Zelda, Mario, Bloodborne…) usam a capa da infobox da Wikipedia.
5. As imagens são **baixadas** para `apps/api/storage/media` e servidas em `/media/*` — o navegador nunca acessa CDNs externos. Isso deixa o app imune a bloqueios de rede e independente das fontes.

O sync respeita os limites da Wikimedia (intervalo entre chamadas e `Retry-After`), mantém as sinopses em português e reaproveita imagens já baixadas (um `db:reset` não precisa de internet). Jogos cadastrados pela web buscam a capa na hora.

`storage/` está no `.gitignore`: capas são material com direitos autorais das publicadoras; para um portfólio não comercial o uso é razoável, mas não as redistribua num repositório público.

#### IGDB (opcional, prioridade máxima quando configurado)

Se a sua rede permitir, crie um app em <https://dev.twitch.tv/console/apps> (exige 2FA na Twitch) e preencha `IGDB_CLIENT_ID`/`IGDB_CLIENT_SECRET` em `apps/api/.env`. O IGDB passa a ser a primeira fonte de arte e habilita a importação de jogos completos na tela **Cadastrar jogo**. Revise os [termos do IGDB](https://api-docs.igdb.com/#about) antes de uso comercial.

## Scripts

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Sobe tudo em modo watch (Turborepo) |
| `pnpm build` | Build de produção de todos os pacotes |
| `pnpm typecheck` | Checagem de tipos em todo o monorepo |
| `pnpm db:reset` | Recria o banco e roda o seed de novo |
| `pnpm catalog:sync` | Busca capas e banners para o catálogo |

## Próximos passos sugeridos

- Importar biblioteca e horas da Steam (Steam Web API)
- "O que jogo agora?" — sugestão do backlog pelo tempo disponível
- Retrospectiva anual compartilhável
- Comentários em reviews, notificações
- Testes (Jest/Vitest na API, Playwright no web) e CI
