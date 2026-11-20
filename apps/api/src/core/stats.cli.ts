import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from './prisma.service';
import { StatsService } from './stats.service';

/**
 * Recalcula as estatísticas desnormalizadas de todos os jogos (nota média, jogadores, likes).
 * Útil depois de mudar a regra de alguma delas. Só lê e grava no banco.
 *
 * pnpm stats:refresh
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const stats = app.get(StatsService);

  const games = await prisma.game.findMany({ select: { id: true, playerCount: true } });
  let changed = 0;
  for (const g of games) {
    await stats.refreshGame(g.id);
    const after = await prisma.game.findUnique({ where: { id: g.id }, select: { playerCount: true } });
    if (after && after.playerCount !== g.playerCount) changed++;
  }
  console.log(`✅ ${games.length} jogos recalculados · ${changed} com número de jogadores alterado`);
  await app.close();
  process.exit(0);
}

main();
