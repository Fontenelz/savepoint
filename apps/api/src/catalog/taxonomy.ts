import { slugify } from '@savepoint/shared';

/**
 * Gêneros das fontes externas (IGDB e RAWG em inglês, loja da Steam em português)
 * → gênero do catálogo. `null` = não é gênero (ex.: "Free to Play", "Early Access").
 * A chave é o slug do nome original.
 */
const GENRE_MAP: Record<string, readonly [slug: string, name: string] | null> = {
  action: ['acao', 'Ação'],
  adventure: ['aventura', 'Aventura'],
  platform: ['plataforma', 'Plataforma'],
  platformer: ['plataforma', 'Plataforma'],
  racing: ['corrida', 'Corrida'],
  'role-playing-rpg': ['rpg', 'RPG'],
  rpg: ['rpg', 'RPG'],
  shooter: ['tiro', 'Tiro'],
  fighting: ['luta', 'Luta'],
  simulator: ['simulacao', 'Simulação'],
  simulation: ['simulacao', 'Simulação'],
  strategy: ['estrategia', 'Estratégia'],
  'real-time-strategy-rts': ['estrategia', 'Estratégia'],
  'turn-based-strategy-tbs': ['estrategia', 'Estratégia'],
  tactical: ['estrategia', 'Estratégia'],
  sport: ['esportes', 'Esportes'],
  sports: ['esportes', 'Esportes'],
  esporte: ['esportes', 'Esportes'],
  puzzle: ['puzzle', 'Puzzle'],
  indie: ['indie', 'Indie'],
  arcade: ['arcade', 'Arcade'],
  casual: ['casual', 'Casual'],
  music: ['musica', 'Música'],
  'point-and-click': ['point-and-click', 'Point-and-click'],
  'hack-and-slash-beat-em-up': ['hack-and-slash', "Hack and slash"],
  'visual-novel': ['visual-novel', 'Visual novel'],
  'card-board-game': ['cartas-e-tabuleiro', 'Cartas e tabuleiro'],
  'board-games': ['cartas-e-tabuleiro', 'Cartas e tabuleiro'],
  card: ['cartas-e-tabuleiro', 'Cartas e tabuleiro'],
  'massively-multiplayer': ['multijogador-massivo', 'Multijogador massivo'],
  'multijogador-massivo': ['multijogador-massivo', 'Multijogador massivo'],
  moba: ['moba', 'MOBA'],
  'quiz-trivia': ['quiz', 'Quiz'],
  pinball: ['pinball', 'Pinball'],
  family: ['familia', 'Família'],
  educational: ['educativo', 'Educativo'],
  // Categorias da loja que não são gênero
  'free-to-play': null,
  'gratuitos-para-jogar': null,
  'gratuito-para-jogar': null,
  'early-access': null,
  'acesso-antecipado': null,
};

/** Gênero canônico do catálogo para um nome vindo de fonte externa (null = ignorar). */
export function canonicalGenre(name: string, slug = slugify(name)): { slug: string; name: string } | null {
  if (!slug) return null;
  if (slug in GENRE_MAP) {
    const target = GENRE_MAP[slug];
    return target ? { slug: target[0], name: target[1] } : null;
  }
  return { slug, name };
}

type PlatformTarget = { slug: string; name: string; short: string };
const MAC: PlatformTarget = { slug: 'mac', name: 'Mac', short: 'Mac' };
const MOBILE: PlatformTarget = { slug: 'mobile', name: 'iOS / Android', short: 'Mobile' };
const XSX: PlatformTarget = { slug: 'xsx', name: 'Xbox Series X|S', short: 'XSX' };

/** Plataformas que cada fonte escreve de um jeito → plataforma do catálogo (chave: nome em minúsculas). */
const PLATFORM_MAP: Record<string, PlatformTarget> = {
  mac: MAC,
  macos: MAC,
  android: MOBILE,
  ios: MOBILE,
  'xbox series s/x': XSX,
  'xbox series x|s': XSX,
};

/** Plataforma canônica quando a fonte usa outro nome para uma que já existe; null = usar como veio. */
export function canonicalPlatform(p: { name: string; short: string }): PlatformTarget | null {
  return PLATFORM_MAP[p.name.toLowerCase()] ?? PLATFORM_MAP[p.short.toLowerCase()] ?? null;
}
