import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CatalogService } from './catalog.service';
import { IgdbProvider } from './providers/igdb.provider';

/**
 * Importação em massa do IGDB para o banco local (feita uma vez; o app não depende do IGDB depois).
 *
 * pnpm catalog:import              → 200 jogos mais populares
 * pnpm catalog:import --limit 500  → quantidade personalizada
 *
 * Precisa de IGDB_CLIENT_ID e IGDB_CLIENT_SECRET. Os jogos vão para o banco de DATABASE_URL
 * e as imagens para o armazenamento configurado (Vercel Blob se houver BLOB_READ_WRITE_TOKEN).
 * Idempotente: jogos já importados são pulados e os do catálogo curado só ganham o id do IGDB.
 */
async function main() {
  const arg = process.argv.indexOf('--limit');
  const limit = arg > -1 ? Number(process.argv[arg + 1]) : 200;
  if (!Number.isInteger(limit) || limit < 1) {
    console.error('Uso: pnpm catalog:import [--limit N]');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const igdb = app.get(IgdbProvider);
  const catalog = app.get(CatalogService);
  if (!igdb.isEnabled()) {
    console.error('✗ Defina IGDB_CLIENT_ID e IGDB_CLIENT_SECRET (https://api-docs.igdb.com/#account-creation).');
    await app.close();
    process.exit(1);
  }

  console.log(`\n📥 Importando os ${limit} jogos mais populares do IGDB\n`);
  const count = { created: 0, linked: 0, exists: 0, failed: 0 };
  let done = 0;

  for (let offset = 0; offset < limit; offset += 500) {
    const page = await igdb.popular(Math.min(500, limit - offset), offset);
    if (!page.length) break;
    for (const ext of page) {
      done++;
      const prefix = `[${String(done).padStart(String(limit).length)}/${limit}] ${ext.title}`;
      try {
        const r = await catalog.importExternal(ext, null);
        count[r.status]++;
        const label = { created: '✓ importado', linked: '↔ já no catálogo (vinculado)', exists: '· já importado' }[r.status];
        console.log(`  ${prefix} — ${label}`);
      } catch (e) {
        count.failed++;
        console.log(`  ${prefix} — ✗ ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  console.log(
    `\n✅ ${count.created} importados · ${count.linked} vinculados ao catálogo curado · ` +
      `${count.exists} já existiam · ${count.failed} falhas`,
  );
  if (count.created) console.log('ℹ️  Rode `pnpm catalog:sync` se algum jogo novo ficou sem capa ou banner.');
  await app.close();
  process.exit(count.failed && !count.created ? 1 : 0);
}

main();
