import { Injectable } from '@nestjs/common';
import type { Prisma, Save } from '@prisma/client';
import { CLOSED_STATUSES, type PlayStatus, type ViewerSave } from '@savepoint/shared';
import { saveSummarySelect, toSaveSummary } from './mappers';
import { PrismaService } from './prisma.service';

type Tx = Prisma.TransactionClient;

/**
 * Hoje como data (sem hora), igual às colunas @db.Date. No fuso de Brasília: em UTC, depois das 21h
 * o "hoje" do servidor já seria amanhã para quem usa o site.
 */
export function todayDate() {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  return new Date(day);
}

export function isClosed(status: PlayStatus | null | undefined) {
  return status != null && CLOSED_STATUSES.includes(status);
}

/**
 * Regras da jornada do jogador (saves). O status da estante (UserGame) reflete o save atual:
 *
 * - Quero jogar → Jogando: abre o Save 1.
 * - Jogando ↔ Pausado: muda o save aberto.
 * - → Zerado / 100% / Abandonado: fecha o save (sem save, cria o Save 1 já fechado).
 * - Fechado → Jogando: reabre o MESMO save (correção). Rejogar de verdade é `replay`.
 * - Quero jogar / sem status: não mexe nos saves.
 */
@Injectable()
export class JourneyService {
  constructor(private readonly prisma: PrismaService) {}

  current(tx: Tx, userId: string, gameId: string) {
    return tx.save.findFirst({ where: { userId, gameId }, orderBy: { number: 'desc' } });
  }

  /**
   * Aplica um novo status ao save atual. `checkpoints: false` não registra início/fechamento
   * no diário (importação da Steam, primeiro checkpoint que já marca o começo).
   */
  async applyStatus(
    tx: Tx,
    userId: string,
    gameId: string,
    status: PlayStatus | null | undefined,
    opts: { startedAt?: Date | null; endedAt?: Date | null; platformId?: string | null; checkpoints?: boolean } = {},
  ): Promise<Save | null> {
    const current = await this.current(tx, userId, gameId);
    if (!status || status === 'BACKLOG') return current;

    const writeCheckpoints = opts.checkpoints ?? true;
    const closing = isClosed(status);
    const today = todayDate();

    if (!current) {
      const startedAt = opts.startedAt ?? (closing ? null : today);
      const endedAt = closing ? (opts.endedAt ?? today) : null;
      const save = await tx.save.create({
        data: { userId, gameId, number: 1, status, startedAt, endedAt, platformId: opts.platformId ?? null },
      });
      if (writeCheckpoints) {
        await tx.logEntry.create({
          data: {
            userId,
            gameId,
            saveId: save.id,
            kind: closing ? 'CLOSED' : 'STARTED',
            playedOn: (closing ? endedAt : startedAt) ?? today,
            platformId: opts.platformId ?? null,
          },
        });
      }
      return save;
    }

    if (current.status === status) return current;

    const wasClosed = isClosed(current.status);
    const endedAt = closing ? (wasClosed ? current.endedAt : (opts.endedAt ?? today)) : null;
    const save = await tx.save.update({ where: { id: current.id }, data: { status, endedAt } });

    if (closing && !wasClosed && writeCheckpoints) {
      await tx.logEntry.create({
        data: { userId, gameId, saveId: save.id, kind: 'CLOSED', playedOn: endedAt ?? today, platformId: save.platformId },
      });
    }
    if (!closing && wasClosed) {
      // Reabriu (fechou por engano): o checkpoint de fechamento deixa de valer.
      const closedCp = await tx.logEntry.findFirst({
        where: { saveId: save.id, kind: 'CLOSED' },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (closedCp) await tx.logEntry.delete({ where: { id: closedCp.id } });
    }
    return save;
  }

  /** Save atual do usuário no jogo, para o painel da página do jogo. */
  async viewerSave(userId: string, gameId: string): Promise<ViewerSave | null> {
    const save = await this.prisma.save.findFirst({
      where: { userId, gameId },
      orderBy: { number: 'desc' },
      select: { ...saveSummarySelect, spoiler: true, liked: true, _count: { select: { checkpoints: true } } },
    });
    if (!save) return null;
    return {
      ...toSaveSummary(save),
      review: save.review,
      spoiler: save.spoiler,
      liked: save.liked,
      checkpointCount: save._count.checkpoints,
    };
  }
}
