import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Mantém as estatísticas desnormalizadas de cada jogo (média, nº de jogadores, likes).
 * Isso permite ordenar o catálogo por nota/popularidade sem agregações caras.
 */
@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async refreshGame(gameId: string) {
    const [ratings, playerCount, likeCount] = await Promise.all([
      this.prisma.userGame.aggregate({
        where: { gameId, rating: { not: null } },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.prisma.userGame.count({ where: { gameId, status: { not: null } } }),
      this.prisma.userGame.count({ where: { gameId, liked: true } }),
    ]);

    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        ratingAvg: ratings._avg.rating,
        ratingCount: ratings._count.rating,
        playerCount,
        likeCount,
      },
    });
  }
}
