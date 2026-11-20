import { Injectable } from '@nestjs/common';
import { db } from './runtime';

/**
 * Mantém as estatísticas desnormalizadas de cada jogo (média, nº de jogadores, likes).
 * Isso permite ordenar o catálogo por nota/popularidade sem agregações caras.
 */
@Injectable()
export class StatsService {
  constructor() {}

  async refreshGame(gameId: string) {
    const [ratings, playerCount, likeCount] = await Promise.all([
      db.orm.public.UserGame
        .where({ gameId })
        .where((ug) => ug.rating.isNotNull())
        .aggregate((a) => ({ avg: a.avg('rating'), n: a.count() })),
      db.orm.public.UserGame
        .where({ gameId })
        .where((ug) => ug.status.isNotNull())
        .aggregate((a) => ({ n: a.count() })),
      db.orm.public.UserGame.where({ gameId, liked: true }).aggregate((a) => ({ n: a.count() })),
    ]);

    await db.orm.public.Game.where({ id: gameId }).update({
      ratingAvg: ratings.avg,
      ratingCount: ratings.n,
      playerCount: playerCount.n,
      likeCount: likeCount.n,
    });
  }
}
