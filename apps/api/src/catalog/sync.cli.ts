import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { HttpCacheService } from '../core/http-cache.service';
import { CatalogService } from './catalog.service';

/**
 * pnpm catalog:sync            → busca capa/banner para jogos que ainda não têm
 * pnpm catalog:sync --force    → refaz o catálogo inteiro
 * pnpm catalog:sync --refresh  → descarta o cache de consultas (Wikipedia/Wikidata)
 * --optional                   → usado após o seed: nunca termina com erro
 */
async function main() {
  const force = process.argv.includes('--force');
  const optional = process.argv.includes('--optional');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const catalog = app.get(CatalogService);
  if (process.argv.includes('--refresh')) {
    await app.get(HttpCacheService).clear();
    console.log('🧹 Cache de consultas descartado.');
  }

  const sources = catalog.status().artwork.filter((s) => s.enabled);
  if (!sources.length) {
    console.log('ℹ️  Nenhuma fonte de arte habilitada — mantendo capas geradas.');
    await app.close();
    process.exit(optional ? 0 : 1);
  }

  console.log(`\n🖼  Buscando capas e banners (${sources.map((s) => s.name).join(' → ')})${force ? ' [forçado]' : ''}\n`);
  const report = await catalog.sync({ force, onProgress: (m) => console.log(`  ${m}`) });

  const covers = report.results.filter((r) => r.cover).length;
  const banners = report.results.filter((r) => r.backdrop).length;
  console.log(`\n✅ ${report.total} jogos processados · ${covers} com capa · ${banners} com banner`);
  const missing = report.results.filter((r) => !r.cover).map((r) => r.title);
  if (missing.length) console.log(`⚠️  Sem capa (ficam com a capa gerada): ${missing.join(', ')}`);
  if (report.failed.length) console.log(`✗ Falhas: ${report.failed.map((f) => `${f.slug} (${f.error})`).join(', ')}`);

  await app.close();
  process.exit(optional || !report.failed.length ? 0 : 1);
}

main();
