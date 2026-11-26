import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CatalogDetailsService } from './details.service';

/**
 * Recalcula a sugestão de jogo "sem fim" de todo o catálogo: gêneros (Esportes, Multijogador
 * Massivo) e categorias da loja da Steam (MMO, só multijogador). Pode rodar quantas vezes quiser.
 *
 * pnpm catalog:endless             → gêneros + loja da Steam
 * pnpm catalog:endless --no-steam  → só gêneros (sem rede)
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const details = app.get(CatalogDetailsService);
  const steam = !process.argv.includes('--no-steam');
  console.log(`\n♾  Sugestão "sem fim" (${steam ? 'gêneros + loja da Steam' : 'só gêneros'})\n`);
  const changed = await details.refreshEndlessHints({
    steam,
    onProgress: (title, hint) => console.log(`  ${hint ? '+' : '−'} ${title}`),
  });
  console.log(`\n${changed.length} jogo(s) alterado(s).`);
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
