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
  type RankingData,
} from '@savepoint/shared';
import {
  MIN_STEAM_REVIEWS,
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

/** Top "em alta" da home (ver trendingIds). 12 = Top 10 + mural de capas. */
const TRENDING_DAYS = 21;
const TRENDING_SIZE = 12;

/** Ranking geral (ver ranking()): peso da referência, em notas, e tamanho máximo da lista. */
const RANKING_PRIOR_VOTES = 3;
const RANKING_SIZE = 100;

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
        steamAppId: true,
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
    const [ratingGroups, statusGroups, hours, listCount, logCount, popular, recent, lists, viewer, friends, similar] =
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
        this.similar(
          game.id,
          game.genres.map((g) => g.id),
          game.platforms.map((p) => p.id),
        ),
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
      steamAppId: game.steamAppId,
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
      similar,
    };
  }

  /**
   * Jogos parecidos: pontua os candidatos que dividem algum gênero (2 pontos por gênero em comum,
   * 1 por plataforma) e desempata pela popularidade. Sem gêneros, não há base para comparar.
   */
  private async similar(gameId: string, genreIds: string[], platformIds: string[]): Promise<GameSummary[]> {
    if (!genreIds.length) return [];
    const candidates = await this.prisma.game.findMany({
      where: { id: { not: gameId }, genres: { some: { id: { in: genreIds } } } },
      orderBy: [{ playerCount: 'desc' }, { ratingCount: 'desc' }],
      take: 80,
      select: { id: true, genres: { select: { id: true } }, platforms: { select: { id: true } } },
    });
    const genres = new Set(genreIds);
    const platforms = new Set(platformIds);
    // `candidates` já vem por popularidade; o sort é estável, então o empate mantém essa ordem.
    const ids = candidates
      .map((c) => ({
        id: c.id,
        score:
          2 * c.genres.filter((g) => genres.has(g.id)).length + c.platforms.filter((p) => platforms.has(p.id)).length,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((c) => c.id);
    if (!ids.length) return [];
    const rows = await this.prisma.game.findMany({ where: { id: { in: ids } }, select: gameSummarySelect });
    const byId = new Map(rows.map((r) => [r.id, toGameSummary(r)]));
    return ids.flatMap((id) => byId.get(id) ?? []);
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
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * TRENDING_DAYS);

    const [ids, recentReviews, popularReviews, lists, friends, games, users, logs] = await Promise.all([
      this.trendingIds(since),
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

    const trendingRows = await this.prisma.game.findMany({ where: { id: { in: ids } }, select: gameSummarySelect });
    let trending = ids.map((id) => trendingRows.find((g) => g.id === id)!).filter(Boolean);
    if (trending.length < TRENDING_SIZE) {
      const filler = await this.prisma.game.findMany({
        where: { id: { notIn: ids } },
        orderBy: [{ playerCount: 'desc' }, { title: 'asc' }], // desempate fixo: a ordem não muda entre visitas
        take: TRENDING_SIZE - trending.length,
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

  /**
   * Ranking geral por nota. Entra quem tem ao menos 1 nota da comunidade.
   *
   * Nota do ranking = (n × média da comunidade + RANKING_PRIOR_VOTES × referência) ÷ (n + RANKING_PRIOR_VOTES),
   * a média ponderada usada por MyAnimeList/IMDb: com poucas notas aqui o jogo fica perto da referência;
   * conforme a comunidade avalia, a nota dela passa a dominar.
   * Referência = avaliações da loja da Steam (% positivas ÷ 10) quando há ao menos MIN_STEAM_REVIEWS;
   * sem elas, a média de todas as notas do site.
   * Desempate: mais notas da comunidade, depois título.
   */
  async ranking(): Promise<RankingData> {
    const rows = await this.prisma.$queryRaw<
      { id: string; score: number; avg: number; count: number; steamScore: number | null; steamReviews: number | null; siteAvg: number | null }[]
    >`
      WITH site AS (SELECT AVG("rating")::float8 AS avg FROM "UserGame" WHERE "rating" IS NOT NULL),
      g AS (
        SELECT g."id", g."title", g."ratingAvg"::float8 AS avg, g."ratingCount" AS count,
               CASE WHEN g."steamReviewCount" >= ${MIN_STEAM_REVIEWS} THEN g."steamScore" END AS "steamScore",
               CASE WHEN g."steamReviewCount" >= ${MIN_STEAM_REVIEWS} THEN g."steamReviewCount" END AS "steamReviews"
        FROM "Game" g
        WHERE g."ratingCount" > 0 AND g."ratingAvg" IS NOT NULL
      )
      SELECT g."id", g.avg, g.count, g."steamScore", g."steamReviews", site.avg AS "siteAvg",
             (g.count * g.avg + ${RANKING_PRIOR_VOTES} * COALESCE(LEAST(GREATEST(g."steamScore" / 10.0, 1), 10), site.avg))
               / (g.count + ${RANKING_PRIOR_VOTES}) AS score
      FROM g CROSS JOIN site
      ORDER BY score DESC, g.count DESC, g."title" ASC
      LIMIT ${RANKING_SIZE}
    `;
    const games = await this.prisma.game.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: gameSummarySelect });
    const byId = new Map(games.map((g) => [g.id, toGameSummary(g)]));
    const siteAvg = rows[0]?.siteAvg ?? (await this.siteRatingAvg());
    return {
      items: rows.flatMap((r, i) => {
        const game = byId.get(r.id);
        if (!game) return [];
        return [
          {
            position: i + 1,
            game,
            score: Number(r.score),
            community: { avg: Number(r.avg), count: Number(r.count) },
            steam: r.steamScore != null && r.steamReviews != null ? { score: r.steamScore, reviews: r.steamReviews } : null,
          },
        ];
      }),
      method: { priorVotes: RANKING_PRIOR_VOTES, siteAvg, minSteamReviews: MIN_STEAM_REVIEWS },
    };
  }

  private async siteRatingAvg(): Promise<number | null> {
    const r = await this.prisma.userGame.aggregate({ where: { rating: { not: null } }, _avg: { rating: true } });
    return r._avg.rating;
  }

  /**
   * "Em alta": jogos registrados no diário nos últimos TRENDING_DAYS dias, ordenados pelo número de
   * **pessoas** que os registraram — vários registros da mesma pessoa contam uma vez.
   * Desempate fixo (a ordem não muda entre visitas): jogado mais recentemente, playerCount, título.
   */
  private async trendingIds(since: Date): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ gameId: string }[]>`
      SELECT l."gameId"
      FROM "LogEntry" l
      JOIN "Game" g ON g."id" = l."gameId"
      WHERE l."playedOn" >= ${since}
      GROUP BY l."gameId", g."playerCount", g."title"
      ORDER BY COUNT(DISTINCT l."userId") DESC, MAX(l."playedOn") DESC, g."playerCount" DESC, g."title" ASC
      LIMIT ${TRENDING_SIZE}
    `;
    return rows.map((r) => r.gameId);
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
