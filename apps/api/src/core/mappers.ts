import { Prisma } from '@prisma/client';
import type { GameSummary, ListSummary, LogView, UserGameState } from '@savepoint/shared';

/** Selects e conversores reutilizados por vários módulos (Prisma → contrato da API). */

export const userSummarySelect = {
  id: true,
  username: true,
  displayName: true,
  avatarHue: true,
} satisfies Prisma.UserSelect;

export const gameSummarySelect = {
  id: true,
  slug: true,
  title: true,
  releaseYear: true,
  coverUrl: true,
  developer: true,
  ratingAvg: true,
  platforms: { select: { short: true }, orderBy: { sortOrder: 'asc' } },
  genres: { select: { name: true }, orderBy: { name: 'asc' }, take: 1 },
} satisfies Prisma.GameSelect;

type GameSummaryRow = Prisma.GameGetPayload<{ select: typeof gameSummarySelect }>;

export function toGameSummary(g: GameSummaryRow): GameSummary {
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

export function logSelect(viewerId?: string) {
  return {
    id: true,
    playedOn: true,
    rating: true,
    liked: true,
    review: true,
    spoiler: true,
    finished: true,
    replay: true,
    hours: true,
    createdAt: true,
    platform: { select: { short: true } },
    user: { select: userSummarySelect },
    game: { select: gameSummarySelect },
    _count: { select: { likes: true } },
    likes: { where: { userId: viewerId ?? '__anon__' }, select: { userId: true }, take: 1 },
  } satisfies Prisma.LogEntrySelect;
}

type LogRow = Prisma.LogEntryGetPayload<{ select: ReturnType<typeof logSelect> }>;

export function toLogView(l: LogRow): LogView {
  return {
    id: l.id,
    playedOn: toDateString(l.playedOn)!,
    rating: l.rating,
    liked: l.liked,
    review: l.review,
    spoiler: l.spoiler,
    finished: l.finished,
    replay: l.replay,
    hours: l.hours,
    platform: l.platform?.short ?? null,
    createdAt: l.createdAt.toISOString(),
    user: l.user,
    game: toGameSummary(l.game),
    likeCount: l._count.likes,
    viewerLiked: l.likes.length > 0,
  };
}

export const listSummarySelect = {
  id: true,
  title: true,
  description: true,
  ranked: true,
  updatedAt: true,
  user: { select: userSummarySelect },
  _count: { select: { items: true } },
  items: {
    orderBy: { position: 'asc' },
    take: 5,
    select: { game: { select: gameSummarySelect } },
  },
} satisfies Prisma.GameListSelect;

type ListRow = Prisma.GameListGetPayload<{ select: typeof listSummarySelect }>;

export function toListSummary(l: ListRow): ListSummary {
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    ranked: l.ranked,
    updatedAt: l.updatedAt.toISOString(),
    user: l.user,
    itemCount: l._count.items,
    preview: l.items.map((i) => toGameSummary(i.game)),
  };
}

export const userGameStateSelect = {
  status: true,
  rating: true,
  liked: true,
  favoriteRank: true,
  platformId: true,
  hoursPlayed: true,
  startedAt: true,
  finishedAt: true,
} satisfies Prisma.UserGameSelect;

type StateRow = Prisma.UserGameGetPayload<{ select: typeof userGameStateSelect }>;

export function toUserGameState(s: StateRow): UserGameState {
  return {
    ...s,
    startedAt: toDateString(s.startedAt),
    finishedAt: toDateString(s.finishedAt),
  };
}

export function toDateString(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export function fromDateString(s: string | null | undefined): Date | null | undefined {
  if (s === undefined) return undefined;
  if (s === null) return null;
  return new Date(`${s}T00:00:00.000Z`);
}

export function paginate(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function paged<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
