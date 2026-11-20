import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
  gameSummary,
  listRows,
  logRows,
  paged,
  paginate,
  toGameSummary,
  toListSummary,
  toLogView,
  toUserGameState,
  userGameStateFields,
  userSummaryFields,
} from '../core/mappers';
import { db } from '../core/runtime';
import { PrismaService } from '../core/prisma.service';

const PAGE_SIZE = 42;

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: GameQuery): Promise<Paginated<GameSummary>> {
    let rows = db.orm.public.Game.with(gameSummary);
    if (query.q) rows = rows.where((g) => g.title.ilike(`%${query.q}%`));
    const genre = query.genre;
    const platform = query.platform;
    if (genre) rows = rows.where((g) => g.genres.some((x) => x.slug.eq(genre)));
    if (platform) rows = rows.where((g) => g.platforms.some((x) => x.slug.eq(platform)));
    if (query.year) rows = rows.where({ releaseYear: query.year });
    if (query.sort === 'popular') rows = rows.orderBy([(g) => g.playerCount.desc(), (g) => g.title.asc()]);
    else if (query.sort === 'rating')
      rows = rows.orderBy([(g) => g.ratingAvg.desc({ nulls: 'last' }), (g) => g.ratingCount.desc()]);
    else if (query.sort === 'recent')
      rows = rows.orderBy([(g) => g.releaseYear.desc({ nulls: 'last' }), (g) => g.title.asc()]);
    else rows = rows.orderBy((g) => g.title.asc());

    const [list, total] = await Promise.all([
      rows
        .offset(paginate(query.page, PAGE_SIZE).offset)
        .limit(PAGE_SIZE)
        .all(),
      db.orm.public.Game.aggregate((a) => ({ n: a.count() })),
    ]);
    return paged(list.map(toGameSummary), total.n, query.page, PAGE_SIZE);
  }

  async meta(): Promise<CatalogMeta> {
    const [genres, platforms] = await Promise.all([
      db.orm.public.Genre.select('id', 'slug', 'name').orderBy((g) => g.name.asc()).all(),
      db.orm.public.Platform
        .select('id', 'slug', 'name', 'short')
        .orderBy([(p) => p.sortOrder.asc(), (p) => p.name.asc()])
        .all(),
    ]);
    return { genres, platforms };
  }

  async detail(slug: string, viewerId?: string): Promise<GameDetail> {
    const game = await db.orm.public.Game
      .where({ slug })
      .select(
        'id',
        'slug',
        'title',
        'releaseYear',
        'coverUrl',
        'developer',
        'ratingAvg',
        'summary',
        'publisher',
        'avgHours',
        'backdropUrl',
        'source',
        'ratingCount',
        'playerCount',
        'likeCount',
      )
      .include('genres', (x) => x.select('id', 'slug', 'name').orderBy((y) => y.name.asc()))
      .include('platforms', (x) => x.select('id', 'slug', 'name', 'short').orderBy((y) => y.sortOrder.asc()))
      .include('createdBy', (u) => u.select(...userSummaryFields))
      .first();
    if (!game) throw new NotFoundException('Jogo não encontrado');

    const followerIds = viewerId
      ? (await db.orm.public.Follow.where({ followerId: viewerId }).select('followingId').all()).map((f) => f.followingId)
      : [];

    const [ratingGroups, statusGroups, hours, listCount, logCount, popular, recent, lists, viewer, friends] =
      await Promise.all([
        db.orm.public.UserGame
          .where({ gameId: game.id })
          .where((ug) => ug.rating.isNotNull())
          .groupBy('rating')
          .aggregate((a) => ({ n: a.count() })),
        db.orm.public.UserGame
          .where({ gameId: game.id })
          .where((ug) => ug.status.isNotNull())
          .groupBy('status')
          .aggregate((a) => ({ n: a.count() })),
        db.orm.public.UserGame
          .where({ gameId: game.id })
          .where((ug) => ug.status.in(['COMPLETED', 'MASTERED']))
          .where((ug) => ug.hoursPlayed.isNotNull())
          .aggregate((a) => ({ avg: a.avg('hoursPlayed') })),
        db.orm.public.ListItem.where({ gameId: game.id }).aggregate((a) => ({ n: a.count() })),
        db.orm.public.LogEntry.where({ gameId: game.id }).aggregate((a) => ({ n: a.count() })),
        logRows(viewerId)
          .where({ gameId: game.id })
          .where((l) => l.review.isNotNull())
          .orderBy([(l) => l.likes.count().desc(), (l) => l.createdAt.desc()])
          .limit(4)
          .all(),
        logRows(viewerId)
          .where({ gameId: game.id })
          .where((l) => l.review.isNotNull())
          .orderBy((l) => l.createdAt.desc())
          .limit(6)
          .all(),
        listRows()
          .where((gl) => gl.items.some((i) => i.gameId.eq(game.id)))
          .orderBy((gl) => gl.updatedAt.desc())
          .limit(3)
          .all(),
        viewerId
          ? db.orm.public.UserGame
              .where({ userId: viewerId, gameId: game.id })
              .select(...userGameStateFields)
              .first()
          : Promise.resolve(null),
        viewerId
          ? db.orm.public.UserGame
              .where({ gameId: game.id })
              .where(((ug: any) => ug.user.id.in(followerIds)) as never)
              .orderBy((ug) => ug.updatedAt.desc())
              .limit(18)
              .select('status', 'rating', 'liked')
              .include('user', (u) => u.select(...userSummaryFields))
              .all()
          : Promise.resolve([]),
      ]);

    const histogram = Array.from({ length: 10 }, () => 0);
    for (const g of ratingGroups) if (g.rating) histogram[g.rating - 1] = g.n;

    const statusCounts = Object.fromEntries(PLAY_STATUSES.map((s) => [s, 0])) as Record<PlayStatus, number>;
    for (const g of statusGroups) if (g.status) statusCounts[g.status] = g.n;

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
      createdBy: game.createdBy as GameDetail['createdBy'],
      stats: {
        ratingAvg: game.ratingAvg,
        ratingCount: game.ratingCount,
        histogram,
        statusCounts,
        playerCount: game.playerCount,
        likeCount: game.likeCount,
        listCount: listCount.n,
        logCount: logCount.n,
        communityHours: hours.avg,
      },
      viewer: viewer ? toUserGameState(viewer) : null,
      popularReviews: popular.map(toLogView),
      recentReviews: recent.filter((r) => !popularIds.has(r.id)).map(toLogView),
      lists: lists.map(toListSummary),
      friends: friends as GameDetail['friends'],
    };
  }

  async create(input: CreateGameInput, userId: string): Promise<GameSummary> {
    const slug = await this.uniqueSlug(input.title, input.releaseYear ?? null);

    const created = await db.orm.public.Game.create({
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
      genres: (g) => g.connect((input.genreIds ?? []).map((id) => ({ id }))),
      platforms: (p) => p.connect((input.platformIds ?? []).map((id) => ({ id }))),
    });
    const game = await db.orm.public.Game.with(gameSummary).first({ id: created.id });
    return toGameSummary(game!);
  }

  /** "celeste" → "celeste-2018" → "celeste-2"... até achar um slug livre. */
  async uniqueSlug(title: string, year: number | null): Promise<string> {
    const base = slugify(title) || 'jogo';
    const candidates = [base, ...(year ? [`${base}-${year}`] : [])];
    for (let i = 2; i < 100; i++) candidates.push(`${base}-${i}`);
    const taken = new Set(
      (await db.orm.public.Game.where((g) => g.slug.in(candidates)).select('slug').all()).map((g) => g.slug),
    );
    return candidates.find((c) => !taken.has(c)) ?? `${base}-${Date.now()}`;
  }

  async remove(slug: string, userId: string) {
    const game = await db.orm.public.Game.where({ slug }).select('id', 'createdById', 'playerCount').first();
    if (!game) throw new NotFoundException('Jogo não encontrado');
    if (game.createdById !== userId) throw new ForbiddenException('Só quem cadastrou pode remover');
    if (game.playerCount > 1) throw new ForbiddenException('Outras pessoas já registraram este jogo');
    await db.orm.public.Game.where({ id: game.id }).delete();
  }

  async home(viewerId?: string): Promise<HomeData> {
    const sinceDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 21);
    const sinceDay = sinceDate.toISOString().slice(0, 10);
    const followerIds = viewerId
      ? (await db.orm.public.Follow.where({ followerId: viewerId }).select('followingId').all()).map((f) => f.followingId)
      : [];

    const [trending, recentReviews, popularReviews, lists, friends, games, users, logs] = await Promise.all([
      db.orm.public.Game
        .with(gameSummary)
        .orderBy((g) => g.logs.count((l) => l.playedOn.gte(sinceDay)).desc())
        .limit(12)
        .all(),
      logRows(viewerId)
        .where({ spoiler: false })
        .where((l) => l.review.isNotNull())
        .orderBy((l) => l.createdAt.desc())
        .limit(6)
        .all(),
      logRows(viewerId)
        .where((l) => l.review.isNotNull())
        .where((l) => l.createdAt.gte(sinceDate))
        .orderBy([(l) => l.likes.count().desc(), (l) => l.createdAt.desc()])
        .limit(6)
        .all(),
      listRows().orderBy((gl) => gl.updatedAt.desc()).limit(4).all(),
      viewerId
        ? logRows(viewerId)
            .where(((l: any) => l.user.id.in(followerIds)) as never)
            .orderBy([(l) => l.playedOn.desc(), (l) => l.createdAt.desc()])
            .limit(30) // o front remove jogos repetidos e mostra 6
            .all()
        : Promise.resolve([]),
      db.orm.public.Game.aggregate((a) => ({ n: a.count() })),
      db.orm.public.User.aggregate((a) => ({ n: a.count() })),
      db.orm.public.LogEntry.aggregate((a) => ({ n: a.count() })),
    ]);

    const popularIds = new Set(popularReviews.map((r) => r.id));
    return {
      trending: trending.map(toGameSummary),
      popularReviews: popularReviews.map(toLogView),
      recentReviews: recentReviews.filter((r) => !popularIds.has(r.id)).map(toLogView),
      lists: lists.map(toListSummary),
      friends: friends.map(toLogView),
      totals: { games: games.n, users: users.n, logs: logs.n },
    };
  }

  async searchLite(q: string): Promise<GameSummary[]> {
    const rows = await db.orm.public.Game
      .with(gameSummary)
      .where((g) => g.title.ilike(`%${q}%`))
      .orderBy([(g) => g.playerCount.desc(), (g) => g.title.asc()])
      .limit(10)
      .all();
    return rows.map(toGameSummary);
  }
}
