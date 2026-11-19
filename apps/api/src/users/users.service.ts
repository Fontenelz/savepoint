import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
  type UpdateProfileInput,
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

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private async findId(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user.id;
  }

  async profile(username: string, viewerId?: string): Promise<Profile> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        ...userSummarySelect,
        bio: true,
        createdAt: true,
        _count: { select: { followers: true, following: true, lists: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const [statusGroups, ratingGroups, hours, reviews, thisYear, favorites, recentLogs, recentReviews, playing, played, follows] =
      await Promise.all([
        this.prisma.userGame.groupBy({
          by: ['status'],
          where: { userId: user.id, status: { not: null } },
          _count: { _all: true },
        }),
        this.prisma.userGame.groupBy({
          by: ['rating'],
          where: { userId: user.id, rating: { not: null } },
          _count: { _all: true },
        }),
        this.prisma.userGame.aggregate({ where: { userId: user.id }, _sum: { hoursPlayed: true } }),
        this.prisma.logEntry.count({ where: { userId: user.id, review: { not: null } } }),
        this.prisma.logEntry.groupBy({ by: ['gameId'], where: { userId: user.id, playedOn: { gte: yearStart } } }),
        this.prisma.userGame.findMany({
          where: { userId: user.id, favoriteRank: { not: null } },
          orderBy: { favoriteRank: 'asc' },
          select: { game: { select: gameSummarySelect } },
        }),
        this.prisma.logEntry.findMany({
          where: { userId: user.id },
          orderBy: [{ playedOn: 'desc' }, { createdAt: 'desc' }],
          take: 8,
          select: logSelect(viewerId),
        }),
        this.prisma.logEntry.findMany({
          where: { userId: user.id, review: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: logSelect(viewerId),
        }),
        this.prisma.userGame.findMany({
          where: { userId: user.id, status: 'PLAYING' },
          orderBy: { updatedAt: 'desc' },
          take: 6,
          select: { game: { select: gameSummarySelect } },
        }),
        this.prisma.userGame.findMany({
          where: { userId: user.id, status: { in: PLAYED_STATUSES } },
          select: {
            game: { select: { genres: { select: { name: true } } } },
            platform: { select: { name: true } },
          },
        }),
        viewerId && viewerId !== user.id
          ? this.prisma.follow.findUnique({
              where: { followerId_followingId: { followerId: viewerId, followingId: user.id } },
            })
          : null,
      ]);

    const statusCounts = Object.fromEntries(PLAY_STATUSES.map((s) => [s, 0])) as Record<PlayStatus, number>;
    for (const g of statusGroups) if (g.status) statusCounts[g.status] = g._count._all;

    const histogram = Array.from({ length: 10 }, () => 0);
    for (const g of ratingGroups) if (g.rating) histogram[g.rating - 1] = g._count._all;

    const tally = (names: string[]) => {
      const map = new Map<string, number>();
      for (const n of names) map.set(n, (map.get(n) ?? 0) + 1);
      return [...map.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
    };

    const { _count, ...summary } = user;
    return {
      user: { ...summary, createdAt: user.createdAt.toISOString() },
      isMe: viewerId === user.id,
      viewerFollows: Boolean(follows),
      counts: {
        played: PLAYED_STATUSES.reduce((n, s) => n + statusCounts[s], 0),
        completed: FINISHED_STATUSES.reduce((n, s) => n + statusCounts[s], 0),
        backlog: statusCounts.BACKLOG,
        thisYear: thisYear.length,
        hours: Math.round(hours._sum.hoursPlayed ?? 0),
        reviews,
        lists: _count.lists,
        followers: _count.followers,
        following: _count.following,
      },
      favorites: favorites.map((f) => toGameSummary(f.game)),
      statusCounts,
      histogram,
      topGenres: tally(played.flatMap((p) => p.game.genres.map((g) => g.name))),
      topPlatforms: tally(played.flatMap((p) => (p.platform ? [p.platform.name] : []))),
      recentLogs: recentLogs.map(toLogView),
      recentReviews: recentReviews.map(toLogView),
      currentlyPlaying: playing.map((p) => toGameSummary(p.game)),
    };
  }

  async library(username: string, query: LibraryQuery): Promise<Paginated<LibraryItem>> {
    const userId = await this.findId(username);
    const pageSize = 48;
    const filter: Prisma.UserGameWhereInput =
      query.filter === 'all'
        ? { OR: [{ status: { not: null } }, { rating: { not: null } }, { liked: true }] }
        : query.filter === 'played'
          ? { status: { in: PLAYED_STATUSES } }
          : query.filter === 'liked'
            ? { liked: true }
            : query.filter === 'rated'
              ? { rating: { not: null } }
              : { status: query.filter };
    const where = { userId, ...filter };

    const [rows, total] = await Promise.all([
      this.prisma.userGame.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        select: { ...userGameStateSelect, updatedAt: true, game: { select: gameSummarySelect } },
        ...paginate(query.page, pageSize),
      }),
      this.prisma.userGame.count({ where }),
    ]);

    return paged(
      rows.map(({ game, updatedAt, ...state }) => ({
        game: toGameSummary(game),
        state: toUserGameState(state),
        updatedAt: updatedAt.toISOString(),
      })),
      total,
      query.page,
      pageSize,
    );
  }

  async diary(username: string, page: number, viewerId?: string): Promise<Paginated<LogView>> {
    const userId = await this.findId(username);
    const pageSize = 50;
    const [rows, total] = await Promise.all([
      this.prisma.logEntry.findMany({
        where: { userId },
        orderBy: [{ playedOn: 'desc' }, { createdAt: 'desc' }],
        select: logSelect(viewerId),
        ...paginate(page, pageSize),
      }),
      this.prisma.logEntry.count({ where: { userId } }),
    ]);
    return paged(rows.map(toLogView), total, page, pageSize);
  }

  async reviews(username: string, page: number, viewerId?: string): Promise<Paginated<LogView>> {
    const userId = await this.findId(username);
    const pageSize = 20;
    const where = { userId, review: { not: null } };
    const [rows, total] = await Promise.all([
      this.prisma.logEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: logSelect(viewerId),
        ...paginate(page, pageSize),
      }),
      this.prisma.logEntry.count({ where }),
    ]);
    return paged(rows.map(toLogView), total, page, pageSize);
  }

  async lists(username: string): Promise<ListSummary[]> {
    const userId = await this.findId(username);
    const rows = await this.prisma.gameList.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: listSummarySelect,
    });
    return rows.map(toListSummary);
  }

  async follow(viewerId: string, username: string, follow: boolean) {
    const targetId = await this.findId(username);
    if (targetId === viewerId) throw new BadRequestException('Você não pode seguir a si mesmo');
    const key = { followerId: viewerId, followingId: targetId };
    if (follow) {
      await this.prisma.follow.upsert({ where: { followerId_followingId: key }, create: key, update: {} });
    } else {
      await this.prisma.follow.deleteMany({ where: key });
    }
    return { following: follow };
  }

  async feed(viewerId: string, page: number): Promise<Paginated<LogView>> {
    const pageSize = 30;
    const where: Prisma.LogEntryWhereInput = { user: { followers: { some: { followerId: viewerId } } } };
    const [rows, total] = await Promise.all([
      this.prisma.logEntry.findMany({
        where,
        orderBy: [{ playedOn: 'desc' }, { createdAt: 'desc' }],
        select: logSelect(viewerId),
        ...paginate(page, pageSize),
      }),
      this.prisma.logEntry.count({ where }),
    ]);
    return paged(rows.map(toLogView), total, page, pageSize);
  }

  async suggestions(viewerId: string) {
    const rows = await this.prisma.user.findMany({
      where: { id: { not: viewerId }, followers: { none: { followerId: viewerId } } },
      orderBy: { logs: { _count: 'desc' } },
      take: 6,
      select: { ...userSummarySelect, bio: true },
    });
    return rows;
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { displayName: input.displayName, bio: input.bio ?? null },
      select: { ...userSummarySelect, bio: true },
    });
  }
}
