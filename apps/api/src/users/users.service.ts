import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { or } from '@prisma/orm-postgres/orm-client';
import {
  FINISHED_STATUSES,
  PLAYED_STATUSES,
  PLAY_STATUSES,
  type LibraryItem,
  type LibraryQuery,
  type ListSummary,
  type LogView,
  type Paginated,
  type PlayStatus,
  type Profile,
  type QueueData,
  type QueueItem,
  type UpdateProfileInput,
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

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private async findId(username: string) {
    const user = await db.orm.public.User.where({ username }).select('id').first();
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user.id;
  }

  async profile(username: string, viewerId?: string): Promise<Profile> {
    const user = await db.orm.public.User
      .where({ username })
      .select('id', 'username', 'displayName', 'avatarHue', 'bio', 'createdAt')
      .include('followers', (f) => f.count())
      .include('following', (f) => f.count())
      .include('lists', (l) => l.count())
      .first();
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const yearStartDay = yearStart.toISOString().slice(0, 10);
    const [statusGroups, ratingGroups, hours, reviews, thisYear, favorites, recentLogs, recentReviews, playing, played, follows] =
      await Promise.all([
        db.orm.public.UserGame
          .where({ userId: user.id })
          .where((ug) => ug.status.isNotNull())
          .groupBy('status')
          .aggregate((a) => ({ n: a.count() })),
        db.orm.public.UserGame
          .where({ userId: user.id })
          .where((ug) => ug.rating.isNotNull())
          .groupBy('rating')
          .aggregate((a) => ({ n: a.count() })),
        db.orm.public.UserGame.where({ userId: user.id }).aggregate((a) => ({ sum: a.sum('hoursPlayed') })),
        db.orm.public.LogEntry
          .where({ userId: user.id })
          .where((l) => l.review.isNotNull())
          .aggregate((a) => ({ n: a.count() })),
        db.orm.public.LogEntry
          .where({ userId: user.id })
          .where((l) => l.playedOn.gte(yearStartDay))
          .groupBy('gameId')
          .aggregate((a) => ({ n: a.count() })),
        db.orm.public.UserGame
          .where({ userId: user.id })
          .where((ug) => ug.favoriteRank.isNotNull())
          .orderBy((ug) => ug.favoriteRank.asc())
          .include("game", (g) => g.with(gameSummary) as never)
          .all(),
        logRows(viewerId)
          .where({ userId: user.id })
          .orderBy([(l) => l.playedOn.desc(), (l) => l.createdAt.desc()])
          .limit(18) // carrossel "Atividade recente"
          .all(),
        logRows(viewerId)
          .where({ userId: user.id })
          .where((l) => l.review.isNotNull())
          .orderBy((l) => l.createdAt.desc())
          .limit(3)
          .all(),
        db.orm.public.UserGame
          .where({ userId: user.id, status: 'PLAYING' })
          .orderBy((ug) => ug.updatedAt.desc())
          .limit(18) // carrossel "Jogando agora"
          .include("game", (g) => g.with(gameSummary) as never)
          .all(),
        db.orm.public.UserGame
          .where({ userId: user.id })
          .where((ug) => ug.status.in(PLAYED_STATUSES))
          .include('game', (g) => g.include('genres', (x) => x.select('name')))
          .include('platform', (p) => p.select('name'))
          .all(),
        viewerId && viewerId !== user.id
          ? db.orm.public.Follow.where({ followerId: viewerId, followingId: user.id }).first()
          : Promise.resolve(null),
      ]);

    const statusCounts = Object.fromEntries(PLAY_STATUSES.map((s) => [s, 0])) as Record<PlayStatus, number>;
    for (const g of statusGroups) if (g.status) statusCounts[g.status] = g.n;

    const histogram = Array.from({ length: 10 }, () => 0);
    for (const g of ratingGroups) if (g.rating) histogram[g.rating - 1] = g.n;

    const tally = (names: string[]) => {
      const map = new Map<string, number>();
      for (const n of names) map.set(n, (map.get(n) ?? 0) + 1);
      return [...map.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
    };

    return {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarHue: user.avatarHue,
        bio: user.bio,
        createdAt: user.createdAt.toISOString(),
      },
      isMe: viewerId === user.id,
      viewerFollows: Boolean(follows),
      counts: {
        played: PLAYED_STATUSES.reduce((n, s) => n + statusCounts[s], 0),
        completed: FINISHED_STATUSES.reduce((n, s) => n + statusCounts[s], 0),
        backlog: statusCounts.BACKLOG,
        thisYear: thisYear.length,
        hours: Math.round(hours.sum ?? 0),
        reviews: reviews.n,
        lists: user.lists,
        followers: user.followers,
        following: user.following,
      },
      favorites: favorites.map((f) => toGameSummary(f.game!)),
      statusCounts,
      histogram,
      topGenres: tally(played.flatMap((p) => p.game!.genres.map((g) => g.name))),
      topPlatforms: tally(played.flatMap((p) => (p.platform ? [p.platform.name] : []))),
      recentLogs: recentLogs.map(toLogView),
      recentReviews: recentReviews.map(toLogView),
      currentlyPlaying: playing.map((p) => toGameSummary(p.game!)),
    };
  }

  async library(username: string, query: LibraryQuery): Promise<Paginated<LibraryItem>> {
    const userId = await this.findId(username);
    const pageSize = 48;

    let filtered = db.orm.public.UserGame.where({ userId });
    if (query.filter === 'all')
      filtered = filtered.where((ug) => or(ug.status.isNotNull(), ug.rating.isNotNull(), ug.liked.eq(true)));
    else if (query.filter === 'played') filtered = filtered.where((ug) => ug.status.in(PLAYED_STATUSES));
    else if (query.filter === 'liked') filtered = filtered.where({ liked: true });
    else if (query.filter === 'rated') filtered = filtered.where((ug) => ug.rating.isNotNull());
    else filtered = filtered.where({ status: query.filter });

    const [rows, total] = await Promise.all([
      filtered
        .orderBy((ug) => ug.updatedAt.desc())
        .select(...userGameStateFields, 'updatedAt')
        .include("game", (g) => g.with(gameSummary) as never)
        .offset(paginate(query.page, pageSize).offset)
        .limit(pageSize)
        .all(),
      filtered.aggregate((a) => ({ n: a.count() })),
    ]);

    return paged(
      rows.map(({ game, updatedAt, ...state }) => ({
        game: toGameSummary(game!),
        state: toUserGameState(state as never),
        updatedAt: updatedAt.toISOString(),
      })),
      total.n,
      query.page,
      pageSize,
    );
  }

  /** "Seu save": jogos em andamento e na fila, para o carrossel da home e do perfil. */
  async queue(username: string): Promise<QueueData> {
    const userId = await this.findId(username);
    const rows = () =>
      db.orm.public.UserGame
        .select(...userGameStateFields, 'updatedAt')
        .include('game', (g) =>
          g
            .select('id', 'slug', 'title', 'releaseYear', 'coverUrl', 'developer', 'ratingAvg', 'avgHours')
            .include('platforms', (p) => p.select('short').orderBy((x) => x.sortOrder.asc()))
            .include('genres', (x) => x.select('name').orderBy((y) => y.name.asc()).limit(1)),
        );
    const [playing, backlog] = await Promise.all([
      rows().where({ userId, status: 'PLAYING' }).orderBy((ug) => ug.updatedAt.desc()).limit(30).all(),
      rows().where({ userId, status: 'BACKLOG' }).orderBy((ug) => ug.createdAt.desc()).limit(30).all(),
    ]);
    const toItem = ({ game, updatedAt, ...state }: (typeof playing)[number]): QueueItem => ({
      game: { ...toGameSummary(game!), avgHours: game!.avgHours },
      state: toUserGameState(state as never),
      updatedAt: updatedAt.toISOString(),
    });
    return { playing: playing.map(toItem), backlog: backlog.map(toItem) };
  }

  async diary(username: string, page: number, viewerId?: string): Promise<Paginated<LogView>> {
    const userId = await this.findId(username);
    const pageSize = 50;
    const [rows, total] = await Promise.all([
      logRows(viewerId)
        .where({ userId })
        .orderBy([(l) => l.playedOn.desc(), (l) => l.createdAt.desc()])
        .offset(paginate(page, pageSize).offset)
        .limit(pageSize)
        .all(),
      logRows(viewerId).where({ userId }).aggregate((a) => ({ n: a.count() })),
    ]);
    return paged(rows.map(toLogView), total.n, page, pageSize);
  }

  async reviews(username: string, page: number, viewerId?: string): Promise<Paginated<LogView>> {
    const userId = await this.findId(username);
    const pageSize = 20;
    const [rows, total] = await Promise.all([
      logRows(viewerId)
        .where({ userId })
        .where((l) => l.review.isNotNull())
        .orderBy((l) => l.createdAt.desc())
        .offset(paginate(page, pageSize).offset)
        .limit(pageSize)
        .all(),
      logRows(viewerId)
        .where({ userId })
        .where((l) => l.review.isNotNull())
        .aggregate((a) => ({ n: a.count() })),
    ]);
    return paged(rows.map(toLogView), total.n, page, pageSize);
  }

  async lists(username: string): Promise<ListSummary[]> {
    const userId = await this.findId(username);
    const rows = await listRows()
      .where({ userId })
      .orderBy((gl) => gl.updatedAt.desc())
      .all();
    return rows.map(toListSummary);
  }

  async follow(viewerId: string, username: string, follow: boolean) {
    const targetId = await this.findId(username);
    if (targetId === viewerId) throw new BadRequestException('Você não pode seguir a si mesmo');
    const key = { followerId: viewerId, followingId: targetId };
    if (follow) {
      await db.orm.public.Follow.upsert({ create: key, update: {}, conflictOn: key });
    } else {
      await db.orm.public.Follow.where(key).deleteAll();
    }
    return { following: follow };
  }

  async feed(viewerId: string, page: number): Promise<Paginated<LogView>> {
    const pageSize = 30;
    const followerIds = (await db.orm.public.Follow.where({ followerId: viewerId }).select('followingId').all()).map(
      (f) => f.followingId,
    );
    const [rows, total] = await Promise.all([
      logRows(viewerId)
        .where(((l: any) => l.user.id.in(followerIds)) as never)
        .orderBy([(l) => l.playedOn.desc(), (l) => l.createdAt.desc()])
        .offset(paginate(page, pageSize).offset)
        .limit(pageSize)
        .all(),
      logRows(viewerId)
        .where(((l: any) => l.user.id.in(followerIds)) as never)
        .aggregate((a) => ({ n: a.count() })),
    ]);
    return paged(rows.map(toLogView), total.n, page, pageSize);
  }

  async suggestions(viewerId: string) {
    const followedIds = (await db.orm.public.Follow.where({ followerId: viewerId }).select('followingId').all()).map(
      (f) => f.followingId,
    );
    const rows = await db.orm.public.User
      .where((u) => u.id.neq(viewerId))
      .where((u) => u.id.notIn(followedIds))
      .orderBy((u) => u.logs.count().desc())
      .limit(6)
      .select(...userSummaryFields, 'bio')
      .all();
    return rows;
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    return db.orm.public.User
      .where({ id: userId })
      .select(...userSummaryFields, 'bio')
      .update({ displayName: input.displayName, bio: input.bio ?? null });
  }
}
