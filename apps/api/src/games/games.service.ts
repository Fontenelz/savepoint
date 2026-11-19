import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PLAY_STATUSES,
  slugify,
  type CatalogMeta,
  type CreateGameInput,
  type GameDetail,
  type GameQuery,
  type GameSummary,
  type HomeData,
  type Paginated,
  type PlayStatus,
} from '@savepoint/shared';
import {
  gameSummarySelect,
  listSummarySelect,
  logSelect,
  paged,
  paginate,
  toGameSummary,
  toListSummary,
  toLogView,
  toUserGameState,
  userGameStateSelect,
  userSummarySelect,
} from '../core/mappers';
import { PrismaService } from '../core/prisma.service';

const PAGE_SIZE = 42;

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: GameQuery): Promise<Paginated<GameSummary>> {
    const where: Prisma.GameWhereInput = {
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(query.genre ? { genres: { some: { slug: query.genre } } } : {}),
      ...(query.platform ? { platforms: { some: { slug: query.platform } } } : {}),
      ...(query.year ? { releaseYear: query.year } : {}),
    };

    const orderBy: Prisma.GameOrderByWithRelationInput[] = {
      popular: [{ playerCount: 'desc' as const }, { title: 'asc' as const }],
      rating: [{ ratingAvg: { sort: 'desc' as const, nulls: 'last' as const } }, { ratingCount: 'desc' as const }],
      recent: [{ releaseYear: { sort: 'desc' as const, nulls: 'last' as const } }, { title: 'asc' as const }],
      title: [{ title: 'asc' as const }],
    }[query.sort];

    const [rows, total] = await Promise.all([
      this.prisma.game.findMany({ where, orderBy, select: gameSummarySelect, ...paginate(query.page, PAGE_SIZE) }),
      this.prisma.game.count({ where }),
    ]);
    return paged(rows.map(toGameSummary), total, query.page, PAGE_SIZE);
  }

  async meta(): Promise<CatalogMeta> {
    const [genres, platforms] = await Promise.all([
      this.prisma.genre.findMany({ orderBy: { name: 'asc' }, select: { id: true, slug: true, name: true } }),
      this.prisma.platform.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, slug: true, name: true, short: true },
      }),
    ]);
    return { genres, platforms };
  }

  async detail(slug: string, viewerId?: string): Promise<GameDetail> {
    const game = await this.prisma.game.findUnique({
      where: { slug },
      select: {
        ...gameSummarySelect,
        summary: true,
        publisher: true,
        avgHours: true,
        backdropUrl: true,
        source: true,
        ratingCount: true,
        playerCount: true,
        likeCount: true,
        genres: { select: { id: true, slug: true, name: true }, orderBy: { name: 'asc' } },
        platforms: {
          select: { id: true, slug: true, name: true, short: true },
          orderBy: { sortOrder: 'asc' },
        },
        createdBy: { select: userSummarySelect },
      },
    });
    if (!game) throw new NotFoundException('Jogo não encontrado');

    const reviewWhere = { gameId: game.id, review: { not: null } };
    const [ratingGroups, statusGroups, hours, listCount, logCount, popular, recent, lists, viewer, friends] =
      await Promise.all([
        this.prisma.userGame.groupBy({
          by: ['rating'],
          where: { gameId: game.id, rating: { not: null } },
          _count: { _all: true },
        }),
        this.prisma.userGame.groupBy({
          by: ['status'],
          where: { gameId: game.id, status: { not: null } },
          _count: { _all: true },
        }),
        this.prisma.userGame.aggregate({
          where: { gameId: game.id, status: { in: ['COMPLETED', 'MASTERED'] }, hoursPlayed: { not: null } },
          _avg: { hoursPlayed: true },
        }),
        this.prisma.listItem.count({ where: { gameId: game.id } }),
        this.prisma.logEntry.count({ where: { gameId: game.id } }),
        this.prisma.logEntry.findMany({
          where: reviewWhere,
          orderBy: [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }],
          take: 4,
          select: logSelect(viewerId),
        }),
        this.prisma.logEntry.findMany({
          where: reviewWhere,
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: logSelect(viewerId),
        }),
        this.prisma.gameList.findMany({
          where: { items: { some: { gameId: game.id } } },
          orderBy: { updatedAt: 'desc' },
          take: 3,
          select: listSummarySelect,
        }),
        viewerId
          ? this.prisma.userGame.findUnique({
              where: { userId_gameId: { userId: viewerId, gameId: game.id } },
              select: userGameStateSelect,
            })
          : null,
        viewerId
          ? this.prisma.userGame.findMany({
              where: { gameId: game.id, user: { followers: { some: { followerId: viewerId } } } },
              orderBy: { updatedAt: 'desc' },
              take: 18,
              select: { status: true, rating: true, liked: true, user: { select: userSummarySelect } },
            })
          : [],
      ]);

    const histogram = Array.from({ length: 10 }, () => 0);
    for (const g of ratingGroups) if (g.rating) histogram[g.rating - 1] = g._count._all;

    const statusCounts = Object.fromEntries(PLAY_STATUSES.map((s) => [s, 0])) as Record<PlayStatus, number>;
    for (const g of statusGroups) if (g.status) statusCounts[g.status] = g._count._all;

    // Reviews populares e recentes podem se repetir; mostra cada uma uma vez só.
    const popularIds = new Set(popular.map((p) => p.id));

    return {
      ...toGameSummary({ ...game, genres: game.genres.slice(0, 1) }),
      summary: game.summary,
      publisher: game.publisher,
      avgHours: game.avgHours,
      backdropUrl: game.backdropUrl,
      source: game.source,
      genres: game.genres,
      platformList: game.platforms,
      createdBy: game.createdBy,
      stats: {
        ratingAvg: game.ratingAvg,
        ratingCount: game.ratingCount,
        histogram,
        statusCounts,
        playerCount: game.playerCount,
        likeCount: game.likeCount,
        listCount,
        logCount,
        communityHours: hours._avg.hoursPlayed,
      },
      viewer: viewer ? toUserGameState(viewer) : null,
      popularReviews: popular.map(toLogView),
      recentReviews: recent.filter((r) => !popularIds.has(r.id)).map(toLogView),
      lists: lists.map(toListSummary),
      friends,
    };
  }

  async create(input: CreateGameInput, userId: string): Promise<GameSummary> {
    const slug = await this.uniqueSlug(input.title, input.releaseYear ?? null);

    const game = await this.prisma.game.create({
      data: {
        slug,
        title: input.title,
        releaseYear: input.releaseYear ?? null,
        developer: input.developer ?? null,
        publisher: input.publisher ?? null,
        summary: input.summary ?? null,
        avgHours: input.avgHours ?? null,
        coverUrl: input.coverUrl ?? null,
        source: 'COMMUNITY',
        createdById: userId,
        genres: { connect: (input.genreIds ?? []).map((id) => ({ id })) },
        platforms: { connect: (input.platformIds ?? []).map((id) => ({ id })) },
      },
      select: gameSummarySelect,
    });
    return toGameSummary(game);
  }

  /** "celeste" → "celeste-2018" → "celeste-2"... até achar um slug livre. */
  async uniqueSlug(title: string, year: number | null): Promise<string> {
    const base = slugify(title) || 'jogo';
    const candidates = [base, ...(year ? [`${base}-${year}`] : [])];
    for (let i = 2; i < 100; i++) candidates.push(`${base}-${i}`);
    const taken = new Set(
      (await this.prisma.game.findMany({ where: { slug: { in: candidates } }, select: { slug: true } })).map((g) => g.slug),
    );
    return candidates.find((c) => !taken.has(c)) ?? `${base}-${Date.now()}`;
  }

  async remove(slug: string, userId: string) {
    const game = await this.prisma.game.findUnique({ where: { slug }, select: { id: true, createdById: true, playerCount: true } });
    if (!game) throw new NotFoundException('Jogo não encontrado');
    if (game.createdById !== userId) throw new ForbiddenException('Só quem cadastrou pode remover');
    if (game.playerCount > 1) throw new ForbiddenException('Outras pessoas já registraram este jogo');
    await this.prisma.game.delete({ where: { id: game.id } });
  }

  async home(viewerId?: string): Promise<HomeData> {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 21);

    const [trendingGroups, recentReviews, popularReviews, lists, friends, games, users, logs] = await Promise.all([
      this.prisma.logEntry.groupBy({
        by: ['gameId'],
        where: { playedOn: { gte: since } },
        _count: { gameId: true },
        orderBy: { _count: { gameId: 'desc' } },
        take: 12,
      }),
      this.prisma.logEntry.findMany({
        where: { review: { not: null }, spoiler: false },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: logSelect(viewerId),
      }),
      this.prisma.logEntry.findMany({
        where: { review: { not: null }, createdAt: { gte: since } },
        orderBy: [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }],
        take: 6,
        select: logSelect(viewerId),
      }),
      this.prisma.gameList.findMany({
        orderBy: [{ items: { _count: 'desc' } }, { updatedAt: 'desc' }],
        take: 4,
        select: listSummarySelect,
      }),
      viewerId
        ? this.prisma.logEntry.findMany({
            where: { user: { followers: { some: { followerId: viewerId } } } },
            orderBy: [{ playedOn: 'desc' }, { createdAt: 'desc' }],
            take: 30, // o front remove jogos repetidos e mostra 6
            select: logSelect(viewerId),
          })
        : [],
      this.prisma.game.count(),
      this.prisma.user.count(),
      this.prisma.logEntry.count(),
    ]);

    const ids = trendingGroups.map((g) => g.gameId);
    const trendingRows = await this.prisma.game.findMany({ where: { id: { in: ids } }, select: gameSummarySelect });
    let trending = ids.map((id) => trendingRows.find((g) => g.id === id)!).filter(Boolean);
    if (trending.length < 12) {
      const filler = await this.prisma.game.findMany({
        where: { id: { notIn: ids } },
        orderBy: { playerCount: 'desc' },
        take: 12 - trending.length,
        select: gameSummarySelect,
      });
      trending = [...trending, ...filler];
    }

    const popularIds = new Set(popularReviews.map((r) => r.id));
    return {
      trending: trending.map(toGameSummary),
      popularReviews: popularReviews.map(toLogView),
      recentReviews: recentReviews.filter((r) => !popularIds.has(r.id)).map(toLogView),
      lists: lists.map(toListSummary),
      friends: friends.map(toLogView),
      totals: { games, users, logs },
    };
  }

  async searchLite(q: string): Promise<GameSummary[]> {
    const rows = await this.prisma.game.findMany({
      where: { title: { contains: q, mode: 'insensitive' } },
      orderBy: [{ playerCount: 'desc' }, { title: 'asc' }],
      take: 10,
      select: gameSummarySelect,
    });
    return rows.map(toGameSummary);
  }
}
