import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { checkpointSchema, type CheckpointView } from '@savepoint/shared';
import type { z } from 'zod';
import { JourneyService } from '../core/journey.service';
import { checkpointSelect, fromDateString, toCheckpointView, visibleCheckpoints } from '../core/mappers';
import { PrismaService } from '../core/prisma.service';
import { StatsService } from '../core/stats.service';

type CheckpointInput = z.output<typeof checkpointSchema>;

/** Checkpoints do diário: registros da jornada dentro do save atual. Não carregam nota nem review. */
@Injectable()
export class LogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: StatsService,
    private readonly journey: JourneyService,
  ) {}

  /**
   * Registra um checkpoint no save atual. Sem save (ou só "Quero jogar"), registrar já significa
   * que a pessoa está jogando: abre o Save 1 e a estante vai para "Jogando".
   */
  async create(userId: string, input: CheckpointInput): Promise<CheckpointView> {
    const game = await this.prisma.game.findUnique({ where: { id: input.gameId }, select: { id: true } });
    if (!game) throw new NotFoundException('Jogo não encontrado');
    const playedOn = fromDateString(input.playedOn)!;

    const created = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.userGame.findUnique({
        where: { userId_gameId: { userId, gameId: game.id } },
        select: { status: true, startedAt: true },
      });

      let save = await this.journey.current(tx, userId, game.id);
      if (!save) {
        // O próprio checkpoint marca o começo: sem checkpoint automático de "começou".
        save = (await this.journey.applyStatus(tx, userId, game.id, 'PLAYING', {
          startedAt: playedOn,
          platformId: input.platformId ?? null,
          checkpoints: false,
        }))!;
      }

      if (input.hours != null || input.platformId) {
        save = await tx.save.update({
          where: { id: save.id },
          data: {
            ...(input.hours != null ? { hours: input.hours } : {}),
            ...(input.platformId ? { platformId: input.platformId } : {}),
          },
        });
      }

      // Estante acompanha o save: "Quero jogar"/sem status passa para o status do save.
      const status = !entry?.status || entry.status === 'BACKLOG' ? save.status : entry.status;
      const sync = {
        status,
        ...(input.platformId ? { platformId: input.platformId } : {}),
        ...(input.hours != null ? { hoursPlayed: input.hours } : {}),
        ...(!entry?.startedAt ? { startedAt: save.startedAt ?? playedOn } : {}),
      };
      await tx.userGame.upsert({
        where: { userId_gameId: { userId, gameId: game.id } },
        create: { userId, gameId: game.id, ...sync },
        update: sync,
      });

      return tx.logEntry.create({
        data: {
          userId,
          gameId: game.id,
          saveId: save.id,
          kind: 'SESSION',
          playedOn,
          platformId: input.platformId ?? null,
          hours: input.hours ?? null,
          note: input.note?.length ? input.note : null,
          spoiler: Boolean(input.note) && input.spoiler,
          isPublic: input.isPublic,
        },
        select: checkpointSelect,
      });
    });

    await this.stats.refreshGame(game.id);
    return toCheckpointView(created);
  }

  async get(id: string, viewerId?: string): Promise<CheckpointView> {
    const row = await this.prisma.logEntry.findFirst({
      where: { id, ...visibleCheckpoints(viewerId) },
      select: checkpointSelect,
    });
    if (!row) throw new NotFoundException('Checkpoint não encontrado');
    return toCheckpointView(row);
  }

  /** Mostrar/esconder um checkpoint dos outros. */
  async setVisibility(userId: string, id: string, isPublic: boolean) {
    await this.owned(userId, id);
    await this.prisma.logEntry.update({ where: { id }, data: { isPublic } });
    return { isPublic };
  }

  async remove(userId: string, id: string) {
    await this.owned(userId, id);
    await this.prisma.logEntry.delete({ where: { id } });
  }

  private async owned(userId: string, id: string) {
    const row = await this.prisma.logEntry.findUnique({ where: { id }, select: { userId: true } });
    if (!row) throw new NotFoundException('Checkpoint não encontrado');
    if (row.userId !== userId) throw new ForbiddenException();
  }
}
