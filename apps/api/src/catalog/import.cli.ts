import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CatalogService } from './catalog.service';
import { IgdbProvider } from './providers/igdb.provider';
import { RawgProvider } from './providers/rawg.provider';

/**
 * Importação em massa para o banco local (feita uma vez; o app não depende da fonte depois).
 *
 * pnpm catalog:import                         → 200 jogos mais populares do IGDB
 * pnpm catalog:import --limit 500             → quantidade personalizada
 * pnpm catalog:import --source rawg           → da RAWG (mais adicionados às bibliotecas)
 * pnpm catalog:import --source rawg --offset 200 → continua de onde parou
 *
 * IGDB: IGDB_CLIENT_ID e IGDB_CLIENT_SECRET. RAWG: RAWG_API_KEY.
 * Os jogos vão para o banco de DATABASE_URL e as imagens para o armazenamento configurado
 * (Vercel Blob se houver BLOB_READ_WRITE_TOKEN). Idempotente: jogos já importados são pulados
 * e os que já existem no catálogo só ganham o vínculo com a fonte.
 */
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

type Status = 'created' | 'linked' | 'exists';
const LABEL: Record<Status, string> = {
  created: '✓ importado',
  linked: '↔ já no catálogo (vinculado)',
  exists: '· já importado',
};

async function main() {
  const source = arg('source') ?? 'igdb';
  const limit = Number(arg('limit') ?? 200);
  const offset = Number(arg('offset') ?? 0);
  if (!['igdb', 'rawg'].includes(source) || !Number.isInteger(limit) || limit < 1 || !Number.isInteger(offset) || offset < 0) {
    console.error('Uso: pnpm catalog:import [--source igdb|rawg] [--limit N] [--offset N]');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const catalog = app.get(CatalogService);
  const igdb = app.get(IgdbProvider);
  const rawg = app.get(RawgProvider);
  const provider = source === 'rawg' ? rawg : igdb;
  if (!provider.isEnabled()) {
    console.error(
      source === 'rawg'
        ? '✗ Defina RAWG_API_KEY (https://rawg.io/apidocs).'
        : '✗ Defina IGDB_CLIENT_ID e IGDB_CLIENT_SECRET (https://api-docs.igdb.com/#account-creation).',
    );
    await app.close();
    process.exit(1);
  }

  console.log(`\n📥 Importando ${limit} jogos populares de ${provider.name}${offset ? ` (a partir do ${offset + 1}º)` : ''}\n`);
  const count = { created: 0, linked: 0, exists: 0, failed: 0 };
  let done = 0;
  const report = (title: string, status: Status | Error) => {
    done++;
    const prefix = `[${String(done).padStart(String(limit).length)}/${limit}] ${title}`;
    if (status instanceof Error) {
      count.failed++;
      console.log(`  ${prefix} — ✗ ${status.message || status.name}`);
    } else {
      count[status]++;
      console.log(`  ${prefix} — ${LABEL[status]}`);
    }
  };

  if (source === 'rawg') {
    const list = await rawg.popular(limit, offset);
    for (const item of list) {
      try {
        const r = await rawg.fetch(String(item.id));
        if (!r) throw new Error('não encontrado na RAWG');
        report(item.name, (await catalog.importRawg(r)).status);
      } catch (e) {
        report(item.name, e instanceof Error ? e : new Error(String(e)));
      }
    }
  } else {
    for (let start = offset; start < offset + limit; start += 500) {
      const page = await igdb.popular(Math.min(500, offset + limit - start), start);
      if (!page.length) break;
      for (const ext of page) {
        try {
          report(ext.title, (await catalog.importExternal(ext, null)).status);
        } catch (e) {
          report(ext.title, e instanceof Error ? e : new Error(String(e)));
        }
      }
    }
  }

  console.log(
    `\n✅ ${count.created} importados · ${count.linked} vinculados a jogos do catálogo · ` +
      `${count.exists} já existiam · ${count.failed} falhas`,
  );
  if (count.created) console.log('ℹ️  Rode `pnpm catalog:sync` se algum jogo novo ficou sem capa ou banner.');
  await app.close();
  process.exit(count.failed && !count.created ? 1 : 0);
}

main();
