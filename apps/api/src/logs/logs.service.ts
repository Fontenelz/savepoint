import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { logEntrySchema, type LogView, type PlayStatus, type ReviewComment } from '@savepoint/shared';
import type { z } from 'zod';
import { logRows, toLogView, userSummaryFields } from '../core/mappers';
import { db } from '../core/runtime';
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
    const game = await db.orm.public.Game.first({ id: input.gameId });
    if (!game) throw new NotFoundException('Jogo não encontrado');

    const playedOn = input.playedOn;
    const review = input.review?.length ? input.review : null;

    const { id } = await db.transaction(async (tx) => {
      const created = await tx.orm.public.LogEntry.create({
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
      });

      const current = await tx.orm.public.UserGame
        .where({ userId, gameId: game.id })
        .select('status', 'startedAt')
        .first();

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

      await tx.orm.public.UserGame.upsert({
        create: { userId, gameId: game.id, ...sync },
        update: sync,
        conflictOn: { userId, gameId: game.id } as unknown as { id: string },
      });
      return created;
    });

    await this.stats.refreshGame(game.id);
    const log = await logRows(userId).first({ id });
    if (!log) throw new NotFoundException('Registro não encontrado');
    return toLogView(log);
  }

  async remove(userId: string, id: string) {
    const log = await db.orm.public.LogEntry.where({ id }).select('userId', 'gameId').first();
    if (!log) throw new NotFoundException('Registro não encontrado');
    if (log.userId !== userId) throw new ForbiddenException();
    await db.orm.public.LogEntry.where({ id }).delete();
  }

  async get(id: string, viewerId?: string): Promise<LogView> {
    const log = await logRows(viewerId).first({ id });
    if (!log) throw new NotFoundException('Registro não encontrado');
    return toLogView(log);
  }

  async toggleLike(userId: string, logId: string) {
    const log = await db.orm.public.LogEntry.where({ id: logId }).select('id').first();
    if (!log) throw new NotFoundException('Review não encontrada');

    const key = { userId, logId };
    const existing = await db.orm.public.ReviewLike.where(key).first();
    if (existing) await db.orm.public.ReviewLike.where(key).delete();
    else await db.orm.public.ReviewLike.create({ userId, logId });

    const likeCount = await db.orm.public.ReviewLike.where({ logId }).aggregate((a) => ({ n: a.count() }));
    return { liked: !existing, likeCount: likeCount.n };
  }

  // ─── Respostas (comentários) ───────────────────────────────────────────

  async comments(logId: string, viewerId?: string): Promise<ReviewComment[]> {
    const log = await db.orm.public.LogEntry.where({ id: logId }).select('userId').first();
    if (!log) throw new NotFoundException('Review não encontrada');
    const rows = await db.orm.public.ReviewComment
      .where({ logId })
      .orderBy((c) => c.createdAt.asc())
      .limit(200)
      .select('id', 'body', 'createdAt', 'userId')
      .include('user', (u) => u.select(...userSummaryFields))
      .all();
    return rows.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      user: c.user!,
      canDelete: Boolean(viewerId) && (c.userId === viewerId || log.userId === viewerId),
    }));
  }

  async addComment(userId: string, logId: string, body: string): Promise<ReviewComment> {
    const log = await db.orm.public.LogEntry.where({ id: logId }).select('review').first();
    if (!log) throw new NotFoundException('Review não encontrada');
    if (!log.review) throw new ForbiddenException('Só é possível responder registros com review');
    const c = await db.orm.public.ReviewComment
      .select('id', 'body', 'createdAt')
      .include('user', (u) => u.select(...userSummaryFields))
      .create({ logId, userId, body });
    return { ...c, user: c.user!, createdAt: c.createdAt.toISOString(), canDelete: true };
  }

  /** Autor da resposta ou dono da review podem apagar. */
  async removeComment(userId: string, commentId: string) {
    const c = await db.orm.public.ReviewComment
      .where({ id: commentId })
      .select('userId')
      .include('log', (l) => l.select('userId'))
      .first();
    if (!c) throw new NotFoundException('Resposta não encontrada');
    if (c.userId !== userId && c.log!.userId !== userId) throw new ForbiddenException();
    await db.orm.public.ReviewComment.where({ id: commentId }).delete();
  }
}
