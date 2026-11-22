import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** A partir destas horas jogadas, a nota pesa o máximo na média (ver weightedRating). */
const RATING_WEIGHT_MAX_HOURS = 10;

/**
 * Mantém as estatísticas desnormalizadas de cada jogo (média, nº de jogadores, likes).
 * Isso permite ordenar o catálogo por nota/popularidade sem agregações caras.
 */
@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async refreshGame(gameId: string) {
    const [ratings, playerCount, likeCount] = await Promise.all([
      this.weightedRating(gameId),
      // Jogador = tem status ou horas jogadas (importação da Steam traz só as horas).
      this.prisma.userGame.count({ where: { gameId, OR: [{ status: { not: null } }, { hoursPlayed: { gt: 0 } }] } }),
      this.prisma.userGame.count({ where: { gameId, liked: true } }),
    ]);

    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        ratingAvg: ratings.avg,
        ratingCount: ratings.count,
        playerCount,
        likeCount,
      },
    });
  }

  /**
   * Nota média ponderada pelo tempo de jogo de quem avaliou: quem jogou pouco pesa menos.
   * Peso = horas jogadas, entre 1 e RATING_WEIGHT_MAX_HOURS (1 h → 1, 4 h → 4, 10 h ou mais → 10).
   * Sem horas (ou menos de 1 h) o peso é 1. Acima do teto todos pesam igual: jogar centenas de
   * horas não dá mais voz. O nº de notas (ratingCount) continua sendo a contagem simples.
   */
  private async weightedRating(gameId: string): Promise<{ avg: number | null; count: number }> {
    const [row] = await this.prisma.$queryRaw<{ avg: number | null; count: number }[]>`
      SELECT SUM("rating" * w) / NULLIF(SUM(w), 0) AS avg, COUNT(*)::int AS count
      FROM (
        SELECT "rating"::float8 AS "rating",
               LEAST(GREATEST(COALESCE("hoursPlayed", 0), 1), ${RATING_WEIGHT_MAX_HOURS})::float8 AS w
        FROM "UserGame"
        WHERE "gameId" = ${gameId} AND "rating" IS NOT NULL
      ) r
    `;
    return { avg: row?.avg ?? null, count: row?.count ?? 0 };
  }
}
