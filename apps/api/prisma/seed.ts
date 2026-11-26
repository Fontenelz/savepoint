import { PlayStatus, PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { GAMES, GENRES, LISTS, PLATFORMS, REVIEWS, TASTES, USERS } from './seed-data';
import { ENDLESS_GENRE_SLUGS } from '../src/catalog/endless-hint';

const prisma = new PrismaClient();
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

/** Anotações de checkpoints (sessões). */
const NOTES = [
  'Primeiro chefe derrotado depois de umas dez tentativas.',
  'Explorei o mapa inteiro hoje, a ambientação é absurda.',
  'Travei num puzzle, amanhã eu volto.',
  'Sessão curta, só farmando recurso.',
  'A história finalmente engrenou.',
  'Mudei a build e o jogo ficou outro.',
  'Joguei com amigos, rendeu boas risadas.',
] as const;
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const daysAgo = (d: number) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - d);
  return date;
};

async function main() {
  console.log('🧹 Limpando banco...');
  await prisma.$transaction([
    prisma.reviewLike.deleteMany(),
    prisma.reviewComment.deleteMany(),
    prisma.listItem.deleteMany(),
    prisma.gameList.deleteMany(),
    prisma.logEntry.deleteMany(),
    prisma.save.deleteMany(),
    prisma.userGame.deleteMany(),
    prisma.follow.deleteMany(),
    prisma.game.deleteMany(),
    prisma.genre.deleteMany(),
    prisma.platform.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  console.log('🕹️  Plataformas e gêneros...');
  for (const p of PLATFORMS) await prisma.platform.create({ data: { ...p } });
  for (const [slug, name] of GENRES) await prisma.genre.create({ data: { slug, name } });
  const platforms = new Map((await prisma.platform.findMany()).map((p) => [p.slug, p.id]));

  console.log(`📚 ${GAMES.length} jogos...`);
  const games = new Map<string, { id: string; data: (typeof GAMES)[number] }>();
  for (const g of GAMES) {
    const created = await prisma.game.create({
      data: {
        slug: g.slug,
        title: g.title,
        releaseYear: g.year,
        developer: g.dev,
        publisher: g.pub ?? g.dev,
        summary: g.summary,
        avgHours: g.hours,
        // Curadoria: sem tempo para zerar = jogo sem fim (Minecraft, Mario Kart); esportes e MMO também.
        endlessHint: g.hours === null || g.genres.some((x) => ENDLESS_GENRE_SLUGS.includes(x)),
        source: 'LOCAL',
        genres: { connect: g.genres.map((slug) => ({ slug })) },
        platforms: { connect: g.platforms.map((slug) => ({ slug })) },
      },
    });
    games.set(g.slug, { id: created.id, data: g });
  }

  console.log('👤 Usuários...');
  const passwordHash = await hash(DEMO_PASSWORD, 10);
  const users = new Map<string, string>();
  for (const u of USERS) {
    const created = await prisma.user.create({
      data: {
        username: u.username,
        email: `${u.username}@savepoint.dev`,
        displayName: u.displayName,
        bio: u.bio,
        avatarHue: u.hue,
        passwordHash,
      },
    });
    users.set(u.username, created.id);
  }

  console.log('🗂️  Estantes, diários e reviews...');
  const reviewSaveIds: string[] = [];
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
      // Nota oficial só com save fechado ou "Sem fim" (regra da jornada).
      const rateable = status === 'COMPLETED' || status === 'MASTERED' || status === 'DROPPED' || status === 'ENDLESS';
      const rating = rateable ? Math.max(1, Math.min(10, base)) : null;
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

      await prisma.userGame.create({
        data: {
          userId,
          gameId: g.id,
          status,
          rating,
          liked: rating !== null && rating >= 8 && rand() < 0.8,
          favoriteRank: isFav ? ++favorites : null,
          platformId,
          hoursPlayed: hours,
          startedAt: status === 'BACKLOG' ? null : daysAgo(finishedDay + Math.floor(rand() * 40) + 5),
          finishedAt: finished ? daysAgo(finishedDay) : null,
        },
      });

      if (status === 'BACKLOG') continue;

      // Saves: às vezes um Save 1 já zerado antes (rejogou) + o save atual com checkpoints.
      const closed = finished || status === 'DROPPED';
      const startDay = finishedDay + Math.floor(rand() * 40) + 5;
      const saves: { status: PlayStatus; start: number; end: number | null }[] = [];
      if (finished && rand() < 0.15) saves.push({ status: 'COMPLETED', start: startDay + 200, end: startDay + 160 });
      saves.push({ status, start: startDay, end: closed ? finishedDay : null });

      for (const [i, sv] of saves.entries()) {
        const current = i === saves.length - 1;
        const tier = (rating ?? 5) >= 8 ? 'high' : (rating ?? 5) >= 5 ? 'mid' : 'low';
        const svRateable = sv.status !== 'PLAYING' && sv.status !== 'PAUSED';
        const withReview = svRateable && rand() < (sv.status === 'ENDLESS' ? 0.3 : 0.55);
        const endedAt = sv.end === null ? null : daysAgo(sv.end);
        const save = await prisma.save.create({
          data: {
            userId,
            gameId: g.id,
            number: i + 1,
            status: sv.status,
            startedAt: daysAgo(sv.start),
            endedAt,
            platformId,
            hours,
            rating: svRateable ? rating : null,
            liked: svRateable && rating !== null && rating >= 8,
            review: withReview ? pick(REVIEWS[tier]) : null,
            spoiler: withReview && rand() < 0.08,
            reviewedAt: withReview && endedAt ? new Date(endedAt.getTime() + 1000 * 60 * 60 * 20) : withReview ? daysAgo(0) : null,
          },
        });
        if (withReview) reviewSaveIds.push(save.id);

        const checkpoints: { kind: 'STARTED' | 'SESSION' | 'CLOSED'; day: number; note?: string }[] = [
          { kind: 'STARTED', day: sv.start },
        ];
        const sessions = current ? Math.floor(rand() * 3) : 0;
        for (let k = 0; k < sessions; k++) {
          const day = Math.max(sv.end ?? 0, Math.floor(sv.start - rand() * (sv.start - (sv.end ?? 0))));
          checkpoints.push({ kind: 'SESSION', day, note: rand() < 0.5 ? pick(NOTES) : undefined });
        }
        if (sv.end !== null) checkpoints.push({ kind: 'CLOSED', day: sv.end });
        for (const c of checkpoints) {
          const playedOn = daysAgo(c.day);
          await prisma.logEntry.create({
            data: {
              userId,
              gameId: g.id,
              saveId: save.id,
              kind: c.kind,
              playedOn,
              createdAt: new Date(playedOn.getTime() + 1000 * 60 * 60 * (12 + Math.floor(rand() * 10))),
              platformId,
              note: c.note ?? null,
            },
          });
        }
      }
    }
  }

  console.log('🤝 Follows e curtidas...');
  const ids = [...users.values()];
  for (const a of ids) {
    for (const b of ids) {
      if (a !== b && rand() < 0.7) await prisma.follow.create({ data: { followerId: a, followingId: b } });
    }
  }
  for (const saveId of reviewSaveIds) {
    for (const u of ids) {
      if (rand() < 0.35) await prisma.reviewLike.create({ data: { userId: u, saveId } }).catch(() => undefined);
    }
  }

  console.log('📝 Listas...');
  for (const l of LISTS) {
    await prisma.gameList.create({
      data: {
        userId: users.get(l.owner)!,
        title: l.title,
        description: l.description,
        ranked: l.ranked,
        items: { create: l.games.map((slug, i) => ({ gameId: games.get(slug)!.id, position: i + 1 })) },
      },
    });
  }

  console.log('📊 Recalculando estatísticas...');
  for (const { id } of games.values()) {
    const [ratings, playerCount, likeCount] = await Promise.all([
      prisma.userGame.aggregate({ where: { gameId: id, rating: { not: null } }, _avg: { rating: true }, _count: { rating: true } }),
      prisma.userGame.count({ where: { gameId: id, status: { not: null } } }),
      prisma.userGame.count({ where: { gameId: id, liked: true } }),
    ]);
    await prisma.game.update({
      where: { id },
      data: { ratingAvg: ratings._avg.rating, ratingCount: ratings._count.rating, playerCount, likeCount },
    });
  }

  console.log(`\n✅ Pronto! Entre com "demo" / "${DEMO_PASSWORD}" (ou ana, bruno, carol, davi, elis).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
