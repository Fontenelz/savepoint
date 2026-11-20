import type { CollectionRowOf } from '@prisma/orm-postgres/orm-client';
import type { GameSummary, ListSummary, LogView, UserGameState } from '@savepoint/shared';
import type { Contract } from '../prisma/contract.js';
import { db } from './runtime';

/** Ramos de consulta e conversores reutilizados por vários módulos (ORM 8 → contrato da API). */

/** Resumo de usuário: o mesmo conjunto de campos que o antigo `userSummarySelect`. */
export const userSummaryFields = ['id', 'username', 'displayName', 'avatarHue'] as const;

/** Resumo de jogo: campos + plataformas ordenadas + 1º gênero (antigo `gameSummarySelect`). */
export const gameSummary = db.orm.public.Game.fragment((g) =>
  g
    .select('id', 'slug', 'title', 'releaseYear', 'coverUrl', 'developer', 'ratingAvg')
    .include('platforms', (p) => p.select('short').orderBy((x) => x.sortOrder.asc()))
    .include('genres', (x) => x.select('name').orderBy((y) => y.name.asc()).limit(1)),
);

export type GameRow = CollectionRowOf<ReturnType<typeof gameSummary>>;

export function toGameSummary(g: GameRow): GameSummary {
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    releaseYear: g.releaseYear,
    coverUrl: g.coverUrl,
    developer: g.developer,
    ratingAvg: g.ratingAvg,
    platforms: g.platforms.map((p) => p.short),
    genre: g.genres[0]?.name ?? null,
  };
}

/**
 * Linha de diário completa: plataforma, autor, jogo, contagens de likes/comentários
 * e a curtida de quem vê (antigo `logSelect(viewerId)`).
 */
export function logRows(viewerId?: string) {
  return db.orm.public.LogEntry.include('platform', (p) => p.select('short'))
    .include('user', (u) => u.select('id', 'username', 'displayName', 'avatarHue'))
    .include("game", (g) => g.with(gameSummary) as never)
    .include('likes', (likes) =>
      likes.combine({
        viewer: likes.where((l) => l.userId.eq(viewerId ?? '__anon__')).limit(1),
        total: likes.count(),
      }),
    )
    .include('comments', (comments) => comments.count());
}

export type LogRow = CollectionRowOf<ReturnType<typeof logRows>>;

export function toLogView(l: LogRow): LogView {
  return {
    id: l.id,
    playedOn: l.playedOn,
    rating: l.rating,
    liked: l.liked,
    review: l.review,
    spoiler: l.spoiler,
    finished: l.finished,
    replay: l.replay,
    hours: l.hours,
    platform: l.platform?.short ?? null,
    createdAt: l.createdAt.toISOString(),
    user: l.user!,
    game: toGameSummary(l.game!),
    likeCount: l.likes.total,
    commentCount: l.comments,
    viewerLiked: l.likes.viewer.length > 0,
  };
}

/** Resumo de lista: autor, nº de itens e os 5 primeiros jogos (antigo `listSummarySelect`). */
export function listRows() {
  return db.orm.public.GameList.include('user', (u) => u.select('id', 'username', 'displayName', 'avatarHue'))
    .include('items', (items) =>
      items.combine({
        count: items.count(),
        preview: items.orderBy((i) => i.position.asc()).limit(5).include("game", (g) => g.with(gameSummary) as never),
      }),
    );
}

export type ListRow = CollectionRowOf<ReturnType<typeof listRows>>;

export function toListSummary(l: ListRow): ListSummary {
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    ranked: l.ranked,
    updatedAt: l.updatedAt.toISOString(),
    user: l.user!,
    itemCount: l.items.count,
    preview: l.items.preview.map((i) => toGameSummary(i.game!)),
  };
}

/** Estado do jogo para quem vê (antigo `userGameStateSelect`): só campos escalares. */
export const userGameStateFields = [
  'status',
  'rating',
  'liked',
  'favoriteRank',
  'platformId',
  'hoursPlayed',
  'startedAt',
  'finishedAt',
] as const;

function stateRows() {
  return db.orm.public.UserGame.select(...userGameStateFields);
}

export type StateRow = CollectionRowOf<ReturnType<typeof stateRows>>;

export function toUserGameState(s: StateRow): UserGameState {
  return {
    status: s.status,
    rating: s.rating,
    liked: s.liked,
    favoriteRank: s.favoriteRank,
    platformId: s.platformId,
    hoursPlayed: s.hoursPlayed,
    startedAt: s.startedAt,
    finishedAt: s.finishedAt,
  };
}

export function paginate(page: number, pageSize: number) {
  return { offset: (page - 1) * pageSize, limit: pageSize };
}

export function paged<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
