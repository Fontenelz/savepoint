import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CatalogDetailsService } from './details.service';

/**
 * Completa os jogos que têm id do IGDB: app id da Steam, tempo médio para zerar
 * e sinopse em português (loja da Steam → Wikipedia) para os importados do IGDB.
 * Só preenche o que está vazio; pode rodar quantas vezes quiser.
 *
 * pnpm catalog:enrich
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const details = app.get(CatalogDetailsService);
  if (!details.isEnabled()) {
    console.error('✗ Defina IGDB_CLIENT_ID e IGDB_CLIENT_SECRET (https://api-docs.igdb.com/#account-creation).');
    await app.close();
    process.exit(1);
  }

  console.log('\n🧩 Completando dados do catálogo (IGDB → Steam → Wikipedia)\n');
  const results = await details.enrich({
    onProgress: (r, i, total) => {
      const marks = [
        r.summary === 'steam' ? '📝 sinopse (Steam)' : r.summary === 'wikipedia' ? '📝 sinopse (Wikipedia)' : null,
        r.avgHours ? '⏱ tempo médio' : null,
        r.steamAppId ? '🎮 id Steam' : null,
      ].filter(Boolean);
      console.log(`  [${String(i + 1).padStart(String(total).length)}/${total}] ${r.title} — ${marks.join('  ') || '· nada novo'}`);
    },
  });

  const count = (fn: (r: (typeof results)[number]) => boolean) => results.filter(fn).length;
  console.log(
    `\n✅ ${results.length} jogos · ${count((r) => r.summary !== null)} sinopses em português ` +
      `(${count((r) => r.summary === 'steam')} da Steam, ${count((r) => r.summary === 'wikipedia')} da Wikipedia) · ` +
      `${count((r) => r.avgHours)} tempos médios · ${count((r) => r.steamAppId)} ids da Steam`,
  );
  await app.close();
  process.exit(0);
}

main();
