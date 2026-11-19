import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { logEntrySchema, type LogView, type PlayStatus } from '@savepoint/shared';
import type { z } from 'zod';
import { fromDateString, logSelect, toLogView } from '../core/mappers';
import { PrismaService } from '../core/prisma.service';
import { StatsService } from '../core/stats.service';

type LogInput = z.output<typeof logEntrySchema>;

@Injectable()
export class LogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: StatsService,
  ) {}

  /**
   * Registra uma entrada no diário e sincroniza a estante (UserGame):
   * nota/like/plataforma/horas passam a refletir o registro mais recente.
   */
  async create(userId: string, input: LogInput): Promise<LogView> {
    const game = await this.prisma.game.findUnique({ where: { id: input.gameId }, select: { id: true } });
    if (!game) throw new NotFoundException('Jogo não encontrado');

    const playedOn = fromDateString(input.playedOn)!;
    const review = input.review?.length ? input.review : null;

    const log = await this.prisma.$transaction(async (tx) => {
      const created = await tx.logEntry.create({
        data: {
          userId,
          gameId: game.id,
          playedOn,
          platformId: input.platformId ?? null,
          hours: input.hours ?? null,
          finished: input.finished,
          replay: input.replay,
          rating: input.rating ?? null,
          liked: input.liked,
          review,
          spoiler: input.spoiler,
        },
        select: logSelect(userId),
      });

      const current = await tx.userGame.findUnique({
        where: { userId_gameId: { userId, gameId: game.id } },
        select: { status: true, startedAt: true },
      });

      let status: PlayStatus | null = current?.status ?? null;
      if (input.finished) status = status === 'MASTERED' ? 'MASTERED' : 'COMPLETED';
      else if (!status || status === 'BACKLOG') status = 'PLAYING';

      const sync = {
        status,
        ...(input.rating ? { rating: input.rating } : {}),
        ...(input.liked ? { liked: true } : {}),
        ...(input.platformId ? { platformId: input.platformId } : {}),
        ...(input.hours != null ? { hoursPlayed: input.hours } : {}),
        ...(input.finished ? { finishedAt: playedOn } : {}),
        ...(!current?.startedAt ? { startedAt: playedOn } : {}),
      };

      await tx.userGame.upsert({
        where: { userId_gameId: { userId, gameId: game.id } },
        create: { userId, gameId: game.id, ...sync },
        update: sync,
      });
      return created;
    });

    await this.stats.refreshGame(game.id);
    return toLogView(log);
  }

  async remove(userId: string, id: string) {
    const log = await this.prisma.logEntry.findUnique({ where: { id }, select: { userId: true, gameId: true } });
    if (!log) throw new NotFoundException('Registro não encontrado');
    if (log.userId !== userId) throw new ForbiddenException();
    await this.prisma.logEntry.delete({ where: { id } });
  }

  async get(id: string, viewerId?: string): Promise<LogView> {
    const log = await this.prisma.logEntry.findUnique({ where: { id }, select: logSelect(viewerId) });
    if (!log) throw new NotFoundException('Registro não encontrado');
    return toLogView(log);
  }

  async toggleLike(userId: string, logId: string) {
    const log = await this.prisma.logEntry.findUnique({ where: { id: logId }, select: { id: true } });
    if (!log) throw new NotFoundException('Review não encontrada');

    const key = { userId_logId: { userId, logId } };
    const existing = await this.prisma.reviewLike.findUnique({ where: key });
    if (existing) await this.prisma.reviewLike.delete({ where: key });
    else await this.prisma.reviewLike.create({ data: { userId, logId } });

    const likeCount = await this.prisma.reviewLike.count({ where: { logId } });
    return { liked: !existing, likeCount };
  }
}
