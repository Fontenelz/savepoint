import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MAX_FAVORITES, type LibraryEntryInput, type UserGameState, type ViewerGameMark } from '@savepoint/shared';
import { toUserGameState, userGameStateFields } from '../core/mappers';
import { db } from '../core/runtime';
import { PrismaService } from '../core/prisma.service';
import { StatsService } from '../core/stats.service';

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: StatsService,
  ) {}

  async upsert(userId: string, gameId: string, input: LibraryEntryInput): Promise<UserGameState> {
    await this.ensureGame(gameId);

    const data = {
      status: input.status,
      rating: input.rating,
      liked: input.liked,
      platformId: input.platformId,
      hoursPlayed: input.hoursPlayed,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
    };

    // Ao marcar como zerado pela primeira vez, registra a data automaticamente.
    if ((input.status === 'COMPLETED' || input.status === 'MASTERED') && input.finishedAt === undefined) {
      const current = await db.orm.public.UserGame
        .where({ userId, gameId })
        .select('finishedAt')
        .first();
      if (!current?.finishedAt) data.finishedAt = new Date().toISOString().slice(0, 10);
    }
    if (input.status === 'PLAYING' && input.startedAt === undefined) {
      const current = await db.orm.public.UserGame
        .where({ userId, gameId })
        .select('startedAt')
        .first();
      if (!current?.startedAt) data.startedAt = new Date().toISOString().slice(0, 10);
    }

    const entry = await db.orm.public.UserGame
      .select(...userGameStateFields)
      .upsert({
        create: { userId, gameId, ...data },
        update: data,
        conflictOn: { userId, gameId } as unknown as { id: string },
      });
    await this.stats.refreshGame(gameId);
    return toUserGameState(entry);
  }

  async remove(userId: string, gameId: string) {
    await db.orm.public.UserGame.where({ userId, gameId }).deleteAll();
    await this.stats.refreshGame(gameId);
  }

  /** Adiciona/remove do Top 4 do perfil. */
  async toggleFavorite(userId: string, gameId: string): Promise<UserGameState> {
    await this.ensureGame(gameId);
    const current = await db.orm.public.UserGame
      .where({ userId, gameId })
      .select('favoriteRank')
      .first();

    if (current?.favoriteRank) {
      const removed = current.favoriteRank;
      const entry = await db.transaction(async (tx) => {
        const updated = await tx.orm.public.UserGame
          .where({ userId, gameId })
          .select(...userGameStateFields)
          .update({ favoriteRank: null });
        // Mantém o Top 4 sem buracos: 1, 2, 3...
        const rest = await tx.orm.public.UserGame
          .where({ userId })
          .where((ug) => ug.favoriteRank.gt(removed))
          .orderBy((ug) => ug.favoriteRank.asc())
          .select('id', 'favoriteRank')
          .all();
        for (const r of rest)
          await tx.orm.public.UserGame.where({ id: r.id }).update({ favoriteRank: r.favoriteRank! - 1 });
        return updated;
      });
      return toUserGameState(entry!);
    }

    const used = await db.orm.public.UserGame
      .where({ userId })
      .where((ug) => ug.favoriteRank.isNotNull())
      .aggregate((a) => ({ n: a.count() }));
    if (used.n >= MAX_FAVORITES) {
      throw new BadRequestException(`Seu Top ${MAX_FAVORITES} está cheio. Remova um favorito primeiro.`);
    }
    const entry = await db.orm.public.UserGame
      .select(...userGameStateFields)
      .upsert({
        create: { userId, gameId, favoriteRank: used.n + 1 },
        update: { favoriteRank: used.n + 1 },
        conflictOn: { userId, gameId } as unknown as { id: string },
      });
    return toUserGameState(entry);
  }

  /** Marcas do usuário (status, nota, like, se está em alguma lista) para vários jogos de uma vez. */
  async marks(userId: string, gameIds: string[]): Promise<Record<string, ViewerGameMark>> {
    if (!gameIds.length) return {};
    const [entries, listed] = await Promise.all([
      db.orm.public.UserGame
        .where({ userId })
        .where((ug) => ug.gameId.in(gameIds))
        .select('gameId', 'status', 'rating', 'liked')
        .all(),
      db.orm.public.ListItem
        .where((i) => i.gameId.in(gameIds))
        .where(((i: any) => i.list.userId.eq(userId)) as never)
        .orderBy((i) => i.gameId.asc())
        .distinctOn('gameId')
        .select('gameId')
        .all(),
    ]);
    const inList = new Set(listed.map((l) => l.gameId));
    const out: Record<string, ViewerGameMark> = {};
    for (const e of entries) out[e.gameId] = { status: e.status, rating: e.rating, liked: e.liked, inList: inList.has(e.gameId) };
    for (const id of inList) out[id] ??= { status: null, rating: null, liked: false, inList: true };
    return out;
  }

  private async ensureGame(gameId: string) {
    const game = await db.orm.public.Game.where({ id: gameId }).select('id').first();
    if (!game) throw new NotFoundException('Jogo não encontrado');
  }
}
