import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CatalogDetailsService } from './details.service';

/**
 * Junta gêneros duplicados (inglês × português) e completa os jogos importados (IGDB/RAWG):
 * app id da Steam e tempo médio para zerar (IGDB, se configurado) e sinopse em português
 * (loja da Steam → Wikipedia).
 * Só preenche o que está vazio; pode rodar quantas vezes quiser.
 *
 * pnpm catalog:enrich
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const details = app.get(CatalogDetailsService);
  const genres = await details.normalizeGenres();
  if (genres.merged.length || genres.removed.length) {
    console.log('\n🏷  Gêneros');
    for (const m of genres.merged) console.log(`  ↪ ${m}`);
    if (genres.removed.length) console.log(`  ✗ removidos (não são gênero): ${genres.removed.join(', ')}`);
  }
  const platforms = await details.normalizePlatforms();
  if (platforms.length) {
    console.log('\n🕹  Plataformas');
    for (const m of platforms) console.log(`  ↪ ${m}`);
  }

  console.log('\n🧩 Completando dados do catálogo (IGDB/RAWG → Steam → Wikipedia)\n');
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
