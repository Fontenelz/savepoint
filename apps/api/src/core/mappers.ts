import { Prisma } from '@prisma/client';
import {
  canRate,
  type CheckpointView,
  type GameSummary,
  type ListSummary,
  type ReviewView,
  type SaveSummary,
  type UserGameState,
} from '@savepoint/shared';

/** Selects e conversores reutilizados por vários módulos (Prisma → contrato da API). */

export const userSummarySelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
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
  // Não vão para o GameSummary; estão aqui para quem junta `game` ao estado da estante
  // (userGameStateSelect + game: gameSummarySelect) ainda conseguir calcular a nota sugerida.
  steamScore: true,
  steamReviewCount: true,
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

export const saveSummarySelect = {
  id: true,
  number: true,
  status: true,
  startedAt: true,
  endedAt: true,
  rating: true,
  review: true,
} satisfies Prisma.SaveSelect;

type SaveSummaryRow = Prisma.SaveGetPayload<{ select: typeof saveSummarySelect }>;

export function toSaveSummary(s: SaveSummaryRow): SaveSummary {
  return {
    id: s.id,
    number: s.number,
    status: s.status,
    startedAt: toDateString(s.startedAt),
    endedAt: toDateString(s.endedAt),
    rating: s.rating,
    hasReview: s.review != null,
  };
}

/** Checkpoints visíveis para quem vê: públicos, ou todos se for o dono. */
export function visibleCheckpoints(viewerId?: string): Prisma.LogEntryWhereInput {
  return viewerId ? { OR: [{ isPublic: true }, { userId: viewerId }] } : { isPublic: true };
}

export const checkpointSelect = {
  id: true,
  kind: true,
  playedOn: true,
  hours: true,
  note: true,
  spoiler: true,
  isPublic: true,
  createdAt: true,
  platform: { select: { short: true } },
  save: { select: saveSummarySelect },
  user: { select: userSummarySelect },
  game: { select: gameSummarySelect },
} satisfies Prisma.LogEntrySelect;

type CheckpointRow = Prisma.LogEntryGetPayload<{ select: typeof checkpointSelect }>;

export function toCheckpointView(l: CheckpointRow): CheckpointView {
  return {
    id: l.id,
    kind: l.kind,
    playedOn: toDateString(l.playedOn)!,
    hours: l.hours,
    platform: l.platform?.short ?? null,
    note: l.note,
    spoiler: l.spoiler,
    isPublic: l.isPublic,
    createdAt: l.createdAt.toISOString(),
    save: toSaveSummary(l.save),
    user: l.user,
    game: toGameSummary(l.game),
  };
}

/** Saves com review publicada. */
export const hasReview = { review: { not: null } } satisfies Prisma.SaveWhereInput;

export function reviewSelect(viewerId?: string) {
  return {
    ...saveSummarySelect,
    liked: true,
    spoiler: true,
    hours: true,
    reviewedAt: true,
    createdAt: true,
    platform: { select: { short: true } },
    user: { select: userSummarySelect },
    game: { select: gameSummarySelect },
    _count: { select: { likes: true, comments: true } },
    likes: { where: { userId: viewerId ?? '__anon__' }, select: { userId: true }, take: 1 },
  } satisfies Prisma.SaveSelect;
}

type ReviewRow = Prisma.SaveGetPayload<{ select: ReturnType<typeof reviewSelect> }>;

export function toReviewView(r: ReviewRow): ReviewView {
  return {
    id: r.id,
    save: toSaveSummary(r),
    rating: r.rating,
    liked: r.liked,
    review: r.review,
    spoiler: r.spoiler,
    createdAt: (r.reviewedAt ?? r.createdAt).toISOString(),
    platform: r.platform?.short ?? null,
    hours: r.hours,
    user: r.user,
    game: toGameSummary(r.game),
    likeCount: r._count.likes,
    commentCount: r._count.comments,
    viewerLiked: r.likes.length > 0,
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
  game: { select: { steamScore: true, steamReviewCount: true } },
} satisfies Prisma.UserGameSelect;

type StateRow = Prisma.UserGameGetPayload<{ select: typeof userGameStateSelect }>;

/** Abaixo disso a % da Steam oscila demais para virar sugestão. */
export const MIN_STEAM_REVIEWS = 20;

/** % de avaliações positivas → nota de 1 a 10 (96% → 10 = 5★, 91% → 9, 75% → 8, 50% → 5). */
export function steamScoreToRating(score: number) {
  return Math.min(10, Math.max(1, Math.round(score / 10)));
}

export function toUserGameState({ game, ...s }: StateRow): UserGameState {
  // Só sugere para quem pode avaliar (save fechado ou "Sem fim") e ainda não deu nota.
  const suggested =
    s.rating == null && canRate(s.status) && game.steamScore != null && (game.steamReviewCount ?? 0) >= MIN_STEAM_REVIEWS
      ? { rating: steamScoreToRating(game.steamScore), steamScore: game.steamScore }
      : null;
  return {
    ...s,
    startedAt: toDateString(s.startedAt),
    finishedAt: toDateString(s.finishedAt),
    suggested,
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
