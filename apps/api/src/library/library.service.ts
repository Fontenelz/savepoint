import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MAX_FAVORITES, type LibraryEntryInput, type UserGameState } from '@savepoint/shared';
import { fromDateString, toUserGameState, userGameStateSelect } from '../core/mappers';
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
      startedAt: fromDateString(input.startedAt),
      finishedAt: fromDateString(input.finishedAt),
    };

    // Ao marcar como zerado pela primeira vez, registra a data automaticamente.
    if ((input.status === 'COMPLETED' || input.status === 'MASTERED') && input.finishedAt === undefined) {
      const current = await this.prisma.userGame.findUnique({
        where: { userId_gameId: { userId, gameId } },
        select: { finishedAt: true },
      });
      if (!current?.finishedAt) data.finishedAt = new Date(new Date().toISOString().slice(0, 10));
    }
    if (input.status === 'PLAYING' && input.startedAt === undefined) {
      const current = await this.prisma.userGame.findUnique({
        where: { userId_gameId: { userId, gameId } },
        select: { startedAt: true },
      });
      if (!current?.startedAt) data.startedAt = new Date(new Date().toISOString().slice(0, 10));
    }

    const entry = await this.prisma.userGame.upsert({
      where: { userId_gameId: { userId, gameId } },
      create: { userId, gameId, ...data },
      update: data,
      select: userGameStateSelect,
    });
    await this.stats.refreshGame(gameId);
    return toUserGameState(entry);
  }

  async remove(userId: string, gameId: string) {
    await this.prisma.userGame.deleteMany({ where: { userId, gameId } });
    await this.stats.refreshGame(gameId);
  }

  /** Adiciona/remove do Top 4 do perfil. */
  async toggleFavorite(userId: string, gameId: string): Promise<UserGameState> {
    await this.ensureGame(gameId);
    const current = await this.prisma.userGame.findUnique({
      where: { userId_gameId: { userId, gameId } },
      select: { favoriteRank: true },
    });

    if (current?.favoriteRank) {
      const removed = current.favoriteRank;
      return this.prisma.$transaction(async (tx) => {
        const entry = await tx.userGame.update({
          where: { userId_gameId: { userId, gameId } },
          data: { favoriteRank: null },
          select: userGameStateSelect,
        });
        // Mantém o Top 4 sem buracos: 1, 2, 3...
        const rest = await tx.userGame.findMany({
          where: { userId, favoriteRank: { gt: removed } },
          orderBy: { favoriteRank: 'asc' },
          select: { id: true, favoriteRank: true },
        });
        for (const r of rest) await tx.userGame.update({ where: { id: r.id }, data: { favoriteRank: r.favoriteRank! - 1 } });
        return toUserGameState(entry);
      });
    }

    const used = await this.prisma.userGame.count({ where: { userId, favoriteRank: { not: null } } });
    if (used >= MAX_FAVORITES) {
      throw new BadRequestException(`Seu Top ${MAX_FAVORITES} está cheio. Remova um favorito primeiro.`);
    }
    const entry = await this.prisma.userGame.upsert({
      where: { userId_gameId: { userId, gameId } },
      create: { userId, gameId, favoriteRank: used + 1 },
      update: { favoriteRank: used + 1 },
      select: userGameStateSelect,
    });
    return toUserGameState(entry);
  }

  private async ensureGame(gameId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId }, select: { id: true } });
    if (!game) throw new NotFoundException('Jogo não encontrado');
  }
}
