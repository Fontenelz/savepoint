import { hash } from 'bcryptjs';
import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
import type { PlayStatus } from '@savepoint/shared';
import { GAMES, GENRES, LISTS, PLATFORMS, REVIEWS, TASTES, USERS } from './seed-data';
import type { Contract } from '../src/prisma/contract.js';
import contractJson from '../src/prisma/contract.json';

// Script de seed: cliente próprio lendo a mesma DATABASE_URL de sempre
// (no Compute, o app pega o cliente do serviço: service.load().db.client).
const db = postgres({ contract: contractFromJson<Contract>(contractJson), url: process.env.DATABASE_URL! });
const DEMO_PASSWORD = 'savepoint123';

/** RNG determinístico: o seed gera sempre os mesmos dados. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(42);
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const daysAgo = (d: number) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - d);
  return date;
};
const day = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  console.log('🧹 Limpando banco...');
  await db.transaction(async (tx) => {
    await tx.orm.public.ReviewLike.where((r) => r.id.isNotNull()).deleteAll();
    await tx.orm.public.ListItem.where((r) => r.id.isNotNull()).deleteAll();
    await tx.orm.public.GameList.where((r) => r.id.isNotNull()).deleteAll();
    await tx.orm.public.LogEntry.where((r) => r.id.isNotNull()).deleteAll();
    await tx.orm.public.UserGame.where((r) => r.id.isNotNull()).deleteAll();
    await tx.orm.public.Follow.where((r) => r.followerId.isNotNull()).deleteAll();
    await tx.orm.public.Game.where((r) => r.id.isNotNull()).deleteAll();
    await tx.orm.public.Genre.where((r) => r.id.isNotNull()).deleteAll();
    await tx.orm.public.Platform.where((r) => r.id.isNotNull()).deleteAll();
    await tx.orm.public.User.where((r) => r.id.isNotNull()).deleteAll();
  });

  console.log('🕹️  Plataformas e gêneros...');
  for (const p of PLATFORMS) await db.orm.public.Platform.create({ ...p });
  for (const [slug, name] of GENRES) await db.orm.public.Genre.create({ slug, name });
  const platforms = new Map((await db.orm.public.Platform.select('slug', 'id').all()).map((p) => [p.slug, p.id]));

  console.log(`📚 ${GAMES.length} jogos...`);
  const games = new Map<string, { id: string; data: (typeof GAMES)[number] }>();
  for (const g of GAMES) {
    const created = await db.orm.public.Game.create({
      slug: g.slug,
      title: g.title,
      releaseYear: g.year,
      developer: g.dev,
      publisher: g.pub ?? g.dev,
      summary: g.summary,
      avgHours: g.hours,
      source: 'LOCAL',
      genres: (x) => x.connect(g.genres.map((slug) => ({ slug }))),
      platforms: (x) => x.connect(g.platforms.map((slug) => ({ slug }))),
    });
    games.set(g.slug, { id: created.id, data: g });
  }

  console.log('👤 Usuários...');
  const passwordHash = await hash(DEMO_PASSWORD, 10);
  const users = new Map<string, string>();
  for (const u of USERS) {
    const created = await db.orm.public.User.create({
      username: u.username,
      email: `${u.username}@savepoint.dev`,
      displayName: u.displayName,
      bio: u.bio,
      avatarHue: u.hue,
      passwordHash,
    });
    users.set(u.username, created.id);
  }

  console.log('🗂️  Estantes, diários e reviews...');
  const logIds: string[] = [];
  for (const u of USERS) {
    const userId = users.get(u.username)!;
    const taste = TASTES[u.username];
    // Jogos do gosto da pessoa têm mais chance de estar na estante.
    const pool = [...games.values()].filter((g) => {
      const affinity = g.data.genres.some((x) => taste.includes(x));
      return rand() < (affinity ? 0.75 : 0.25);
    });

    let favorites = 0;
    for (const g of pool) {
      const roll = rand();
      const endless = g.data.hours === null;
      const status: PlayStatus = endless
        ? roll < 0.8 ? 'ENDLESS' : 'BACKLOG'
        : roll < 0.16 ? 'BACKLOG'
        : roll < 0.28 ? 'PLAYING'
        : roll < 0.34 ? 'PAUSED'
        : roll < 0.42 ? 'DROPPED'
        : roll < 0.52 ? 'MASTERED'
        : 'COMPLETED';

      const affinity = g.data.genres.some((x) => taste.includes(x)) ? 1 : -1;
      const base = g.data.q + affinity + Math.round((rand() - 0.5) * 3) - (status === 'DROPPED' ? 4 : 0);
      const rating = status === 'BACKLOG' ? null : Math.max(1, Math.min(10, base));
      const hoursBase = g.data.hours ?? 40 + rand() * 200;
      const hours =
        status === 'BACKLOG' ? null
        : status === 'DROPPED' || status === 'PLAYING' || status === 'PAUSED' ? Math.round(hoursBase * (0.15 + rand() * 0.5))
        : status === 'MASTERED' ? Math.round(hoursBase * (1.3 + rand() * 0.6))
        : Math.round(hoursBase * (0.8 + rand() * 0.5));

      const platformSlug = pick(g.data.platforms);
      const platformId = platforms.get(platformSlug) ?? null;
      const finishedDay = Math.floor(rand() * 420);
      const finished = status === 'COMPLETED' || status === 'MASTERED';
      const isFav = finished && rating !== null && rating >= 9 && favorites < 4 && rand() < 0.7;

      await db.orm.public.UserGame.create({
        userId,
        gameId: g.id,
        status,
        rating,
        liked: rating !== null && rating >= 8 && rand() < 0.8,
        favoriteRank: isFav ? ++favorites : null,
        platformId,
        hoursPlayed: hours,
        startedAt: status === 'BACKLOG' ? null : day(daysAgo(finishedDay + Math.floor(rand() * 40) + 5)),
        finishedAt: finished ? day(daysAgo(finishedDay)) : null,
      });

      if (status === 'BACKLOG') continue;

      // Entradas de diário: uma sessão "jogando" + a zerada (às vezes um replay).
      const entries: { day: number; finished: boolean; replay: boolean }[] = [];
      if (finished) entries.push({ day: finishedDay, finished: true, replay: false });
      else entries.push({ day: Math.floor(rand() * 60), finished: false, replay: false });
      if (finished && rand() < 0.15) entries.push({ day: Math.floor(rand() * finishedDay), finished: true, replay: true });

      for (const e of entries) {
        const tier = (rating ?? 5) >= 8 ? 'high' : (rating ?? 5) >= 5 ? 'mid' : 'low';
        const withReview = rand() < (e.finished ? 0.55 : 0.25);
        const playedOn = daysAgo(e.day);
        const log = await db.orm.public.LogEntry.create({
          userId,
          gameId: g.id,
          playedOn: day(playedOn),
          createdAt: new Date(playedOn.getTime() + 1000 * 60 * 60 * (12 + Math.floor(rand() * 10))),
          platformId,
          hours,
          finished: e.finished,
          replay: e.replay,
          rating,
          liked: rating !== null && rating >= 8,
          review: withReview ? pick(REVIEWS[tier]) : null,
          spoiler: withReview && rand() < 0.08,
        });
        if (withReview) logIds.push(log.id);
      }
    }
  }

  console.log('🤝 Follows e curtidas...');
  const ids = [...users.values()];
  for (const a of ids) {
    for (const b of ids) {
      if (a !== b && rand() < 0.7) await db.orm.public.Follow.create({ followerId: a, followingId: b });
    }
  }
  for (const logId of logIds) {
    for (const u of ids) {
      await db.orm.public.ReviewLike.create({ userId: u, logId }).catch(() => undefined);
    }
  }

  console.log('📝 Listas...');
  for (const l of LISTS) {
    await db.orm.public.GameList.create({
      userId: users.get(l.owner)!,
      title: l.title,
      description: l.description,
      ranked: l.ranked,
      items: (i) => i.create(l.games.map((slug, i) => ({ gameId: games.get(slug)!.id, position: i + 1 }))),
    });
  }

  console.log('📊 Recalculando estatísticas...');
  for (const { id } of games.values()) {
    const [ratings, playerCount, likeCount] = await Promise.all([
      db.orm.public.UserGame
        .where({ gameId: id })
        .where((ug) => ug.rating.isNotNull())
        .aggregate((a) => ({ avg: a.avg('rating'), n: a.count() })),
      db.orm.public.UserGame
        .where({ gameId: id })
        .where((ug) => ug.status.isNotNull())
        .aggregate((a) => ({ n: a.count() })),
      db.orm.public.UserGame.where({ gameId: id, liked: true }).aggregate((a) => ({ n: a.count() })),
    ]);
    await db.orm.public.Game.where({ id }).update({
      ratingAvg: ratings.avg,
      ratingCount: ratings.n,
      playerCount: playerCount.n,
      likeCount: likeCount.n,
    });
  }

  console.log(`\n✅ Pronto! Entre com "demo" / "${DEMO_PASSWORD}" (ou ana, bruno, carol, davi, elis).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.close());
