# Savepoint — contexto do projeto

Diário social de jogos, na linha de Letterboxd (filmes) e Skoob (livros). Projeto de **portfólio**, web primeiro.
Toda a interface e os textos são em **português (pt-BR)**.

## Stack e estrutura

Monorepo **Turborepo + pnpm** (pnpm 12: scripts de build liberados via `allowBuilds` em `pnpm-workspace.yaml`).

```
apps/api/        NestJS 11 + Fastify + Prisma (PostgreSQL). REST em /api, porta 3333
apps/web/        Next.js 15 (App Router), porta 3000. CSS puro com tokens, sem framework de UI
packages/shared/ Schemas Zod, enums e tipos — contrato entre web e api (compila para dist/)
```

- **Next como BFF:** o navegador nunca fala com a API. Server Components buscam dados; Server Actions (`apps/web/app/actions.ts`) fazem mutações. JWT em cookie httpOnly `sp_token`.
- Validação com os mesmos schemas Zod nos dois lados (`ZodPipe` na API).
- `/media/*` (capas/banners) é servido pela API e repassado pelo Next via `rewrites` em `next.config.ts`.

## Rodando

```bash
pnpm install
pnpm db:up        # Postgres no Docker (localhost:5433)
pnpm db:migrate
pnpm db:seed      # catálogo + usuários demo + busca de capas (sync)
pnpm dev          # web :3000, api :3333
```
Login demo: `demo` / `savepoint123` (também `ana`, `bruno`, `carol`, `davi`, `elis`).

Env: `apps/api/.env` (DATABASE_URL, JWT_SECRET, IGDB opcional) e `apps/web/.env.local` (API_URL, DEV_ORIGINS). Nenhum dos dois vai para o git.

## O que já foi feito

**Domínio / API**
- Estante (`UserGame`): 7 status (Quero jogar, Jogando, Pausado, Zerado, 100%, Abandonado, Sem fim), nota 1–10 (meia estrela), like, Top 4, plataforma, horas.
- Diário (`LogEntry`) com replays e reviews (aviso de spoiler); curtidas em reviews.
- Listas (livres ou ranqueadas), follows, feed de atividade, sugestões de quem seguir.
- Estatísticas desnormalizadas em `Game` (`StatsService`).
- Endpoints principais: `/home`, `/games`, `/games/:slug`, `/library/:gameId`, `/logs`, `/lists`, `/users/:username` (+ `/games`, `/diary`, `/reviews`, `/lists`, `/queue`), `/feed`, `/catalog/*`.

**Catálogo e imagens (independente de API de terceiros)**
- Banco local é a fonte da verdade: seed curado (40 jogos) + cadastro pela comunidade.
- Capas/banners: **Wikipedia → Wikidata (Steam app id) → CDN da Steam**, sem chave. IGDB é opcional (prioridade quando configurado) — bloqueado na rede da empresa.
- Imagens **baixadas** para `apps/api/storage/media` (fora do git, direitos autorais). Consultas cacheadas em `storage/cache/http` (30 dias). Respeita rate limit da Wikimedia (429/Retry-After).
- `pnpm catalog:sync` (`--force`, `--refresh`). Jogos sem imagem usam capa procedural (`GameCover`).

**Front**
- Tema escuro; fontes: Bricolage Grotesque (títulos), Inter (texto), JetBrains Mono (números), Big Shoulders (capas geradas e números do Top 10). Navbar com cor própria (`--nav-bg`) e linha em degradê.
- Home: boas-vindas, **"Seu save"** (carrossel jogando + quero jogar, com progresso por horas), **Top 10 em alta** (números gigantes vazados estilo Netflix), novidades dos amigos, reviews e listas.
- Página do jogo com banner, painel de ações (status, estrelas, like, Top 4, diário, listas), histograma, estante da comunidade.
- Perfil com HUD de contadores, Top 4, carrosséis, diário por mês, abas.
- Componentes-chave: `Slider` (carrossel com scroll-snap, tamanhos `md`/`lg`/`rank`), `QueueCarousel`, `TopRanking`, `UserMenu` (fecha ao clicar fora/Esc/navegar), `Avatar` (silhueta, sem iniciais).
- Responsivo verificado em 360/390px (sem overflow horizontal) e desktop.

## Convenções e decisões a manter

- **Verificar visualmente** mudanças de layout com screenshot (desktop e celular) antes de considerar pronto. Chromium headless do Playwright funciona com libs extraídas localmente (sem sudo) e é controlado via CDP.
- Grades com `minmax(0, 1fr)`; imagens de capa em posição absoluta dentro da moldura 3:4 (tamanho real nunca afeta o layout).
- Legenda/tooltip das capas só em dispositivos com mouse (`hover: hover`); no toque, nada fica "grudado".
- Mudanças visuais pedidas pelo usuário: aplicar **só** o que foi pedido; ele prefere ajustes pontuais a redesigns.
- Não rodar `next build` com o `pnpm dev` ativo (os dois usam `.next`).
- Commits com mensagem em português/inglês convencional (`feat:`, `fix:`).

## Produção

- API roda como servidor (`src/main.ts`) **ou** como função serverless (`src/serverless.ts` ← `api/index.js`), ambos via `src/app.factory.ts`.
- Imagens: `MediaService` usa disco local ou **Vercel Blob** (quando há `BLOB_READ_WRITE_TOKEN`). O sync envia para o Blob as imagens já baixadas em `storage/media`.
- Erros conhecidos do Prisma viram 400/404/409 (`PrismaExceptionFilter`). Datas no futuro são rejeitadas.
- Respostas em reviews (`ReviewComment`) e marcas do usuário no catálogo (`GET /library/marks`).

## O que falta / próximos passos

- [ ] Conferir visualmente o último ajuste do Top 10 (alinhamento do "1" com a margem — `.slider--rank` com `--rank-shift`).
- [ ] Testes: nenhum ainda (Jest/Vitest na API, Playwright no web) + CI.
- [x] Limite de tentativas de login (8 erros/15 min por conta, guardado no banco — `LoginThrottle`).
- [ ] Upload de foto de perfil (hoje todos usam a silhueta).
- [ ] Imagens faltando: *Final Fantasy VII Remake* e *Horizon Chase Turbo* (download bloqueado/limitado na rede da empresa — rodar `pnpm catalog:sync` fora dela); *Minecraft* não tem capa na Wikipedia. Exclusivos de console não têm banner (vem da Steam).
- [ ] Importar biblioteca e horas da Steam (o `steamAppId` já é salvo nos jogos).
- [ ] "O que jogo agora?" — sugestão do backlog pelo tempo disponível.
- [ ] Retrospectiva anual compartilhável; comentários em reviews; notificações.
- [ ] **Deploy na Vercel** (código pronto, ver `DEPLOY.md`): site e API como dois projetos, Prisma Postgres + Vercel Blob. Falta: repositório no GitHub, criar os projetos e validar o 1º deploy real (inclusão do binário do Prisma, pnpm 12 via corepack).
- [ ] Acesso pelo celular físico: exige `portproxy` + regra de firewall no Windows (WSL2) — ver histórico/README; rede da empresa pode bloquear.
