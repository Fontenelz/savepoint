import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { canRate, saveReviewSchema, type ReviewComment, type ReviewView, type ViewerSave } from '@savepoint/shared';
import type { z } from 'zod';
import { isClosed, JourneyService, todayDate } from '../core/journey.service';
import { reviewSelect, toReviewView, userSummarySelect } from '../core/mappers';
import { PrismaService } from '../core/prisma.service';
import { StatsService } from '../core/stats.service';

type ReviewInput = z.output<typeof saveReviewSchema>;

@Injectable()
export class SavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: StatsService,
    private readonly journey: JourneyService,
  ) {}

  /** Rejogar: só com o save atual fechado. Abre o Save N+1 e a estante volta para "Jogando". */
  async replay(userId: string, gameId: string): Promise<ViewerSave> {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.journey.current(tx, userId, gameId);
      if (!current || !isClosed(current.status)) {
        throw new BadRequestException('Só dá para rejogar um jogo zerado ou abandonado.');
      }
      const today = todayDate();
      const save = await tx.save.create({
        data: { userId, gameId, number: current.number + 1, status: 'PLAYING', startedAt: today, platformId: current.platformId },
      });
      await tx.logEntry.create({
        data: { userId, gameId, saveId: save.id, kind: 'STARTED', playedOn: today, platformId: save.platformId },
      });
      await tx.userGame.update({
        where: { userId_gameId: { userId, gameId } },
        data: { status: 'PLAYING', startedAt: today, finishedAt: null },
      });
    });
    await this.stats.refreshGame(gameId);
    return (await this.journey.viewerSave(userId, gameId))!;
  }

  /**
   * Nota + review de um save. Só com o save fechado (ou "Sem fim").
   * `official`: a nota vira a nota oficial do jogo (a da estante, que entra na média).
   * Sem nota oficial ainda, a deste save passa a ser a oficial de qualquer forma.
   */
  async review(userId: string, saveId: string, input: ReviewInput): Promise<ViewerSave> {
    const save = await this.prisma.save.findUnique({
      where: { id: saveId },
      select: { userId: true, gameId: true, status: true, reviewedAt: true },
    });
    if (!save) throw new NotFoundException('Save não encontrado');
    if (save.userId !== userId) throw new ForbiddenException();
    if (!canRate(save.status)) throw new BadRequestException('Avalie quando zerar ou abandonar o jogo.');

    const review = input.review?.length ? input.review : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.save.update({
        where: { id: saveId },
        data: {
          rating: input.rating,
          review,
          spoiler: Boolean(review) && input.spoiler,
          liked: input.liked,
          reviewedAt: review ? (save.reviewedAt ?? new Date()) : null,
        },
      });
      const entry = await tx.userGame.findUnique({
        where: { userId_gameId: { userId, gameId: save.gameId } },
        select: { rating: true },
      });
      const official = input.official || entry?.rating == null;
      await tx.userGame.update({
        where: { userId_gameId: { userId, gameId: save.gameId } },
        data: {
          ...(official && input.rating != null ? { rating: input.rating } : {}),
          ...(input.liked ? { liked: true } : {}),
        },
      });
    });
    await this.stats.refreshGame(save.gameId);
    return (await this.journey.viewerSave(userId, save.gameId))!;
  }

  async get(id: string, viewerId?: string): Promise<ReviewView> {
    const row = await this.prisma.save.findFirst({ where: { id, review: { not: null } }, select: reviewSelect(viewerId) });
    if (!row) throw new NotFoundException('Review não encontrada');
    return toReviewView(row);
  }

  async toggleLike(userId: string, saveId: string) {
    const save = await this.prisma.save.findFirst({ where: { id: saveId, review: { not: null } }, select: { id: true } });
    if (!save) throw new NotFoundException('Review não encontrada');

    const key = { userId_saveId: { userId, saveId } };
    const existing = await this.prisma.reviewLike.findUnique({ where: key });
    if (existing) await this.prisma.reviewLike.delete({ where: key });
    else await this.prisma.reviewLike.create({ data: { userId, saveId } });

    const likeCount = await this.prisma.reviewLike.count({ where: { saveId } });
    return { liked: !existing, likeCount };
  }

  // ─── Respostas (comentários) ───────────────────────────────────────────
  // Qualquer pessoa logada pode responder, independentemente do status dela no jogo.

  async comments(saveId: string, viewerId?: string): Promise<ReviewComment[]> {
    const save = await this.prisma.save.findUnique({ where: { id: saveId }, select: { userId: true } });
    if (!save) throw new NotFoundException('Review não encontrada');
    const rows = await this.prisma.reviewComment.findMany({
      where: { saveId },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: { id: true, body: true, createdAt: true, userId: true, user: { select: userSummarySelect } },
    });
    return rows.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      user: c.user,
      canDelete: Boolean(viewerId) && (c.userId === viewerId || save.userId === viewerId),
    }));
  }

  async addComment(userId: string, saveId: string, body: string): Promise<ReviewComment> {
    const save = await this.prisma.save.findUnique({ where: { id: saveId }, select: { review: true } });
    if (!save) throw new NotFoundException('Review não encontrada');
    if (!save.review) throw new ForbiddenException('Só é possível responder saves com review');
    const c = await this.prisma.reviewComment.create({
      data: { saveId, userId, body },
      select: { id: true, body: true, createdAt: true, user: { select: userSummarySelect } },
    });
    return { ...c, createdAt: c.createdAt.toISOString(), canDelete: true };
  }

  /** Autor da resposta ou dono da review podem apagar. */
  async removeComment(userId: string, commentId: string) {
    const c = await this.prisma.reviewComment.findUnique({
      where: { id: commentId },
      select: { userId: true, save: { select: { userId: true } } },
    });
    if (!c) throw new NotFoundException('Resposta não encontrada');
    if (c.userId !== userId && c.save.userId !== userId) throw new ForbiddenException();
    await this.prisma.reviewComment.delete({ where: { id: commentId } });
  }
}
