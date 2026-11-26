import type { SteamAppDetails } from './providers/steam-store.client';

/**
 * Sugestão de jogo "sem fim" (sem final definido): FIFA, NBA 2K, CS2, MMOs.
 * É só um palpite a partir dos dados do catálogo, usado para destacar o status "Sem fim"
 * na página do jogo. Nunca muda o status de ninguém: quem joga o modo carreira do FIFA
 * pode marcar "Zerado" normalmente.
 */

/** Gêneros do catálogo (já normalizados de IGDB/RAWG/Steam) que indicam jogo sem fim. */
export const ENDLESS_GENRE_SLUGS = ['esportes', 'multijogador-massivo'];

/** Ids das categorias e gêneros da loja da Steam (conferidos na API: CS2, EA FC 25, Witcher 3). */
const STEAM_CATEGORY = { MULTI_PLAYER: '1', SINGLE_PLAYER: '2', MMO: '20' } as const;
const STEAM_GENRE = { SPORTS: '18', MASSIVELY_MULTIPLAYER: '29' } as const;

/** Jogo curado (seed) sem tempo para zerar: a curadoria já o tratou como sem fim (Minecraft, Mario Kart). */
export function curatedEndless(g: { source: string; avgHours: number | null }) {
  return g.source === 'LOCAL' && g.avgHours == null;
}

export function genresSuggestEndless(slugs: string[]) {
  return slugs.some((s) => ENDLESS_GENRE_SLUGS.includes(s));
}

/**
 * Pela loja da Steam: MMO, esporte, ou multijogador sem single-player (jogos só online,
 * como CS2, PUBG e Dota 2).
 */
export function steamSuggestsEndless(d: Pick<SteamAppDetails, 'categories' | 'genres'> | null | undefined) {
  if (!d) return false;
  const cats = new Set((d.categories ?? []).map((c) => String(c.id)));
  const genres = new Set((d.genres ?? []).map((g) => String(g.id)));
  if (cats.has(STEAM_CATEGORY.MMO) || genres.has(STEAM_GENRE.MASSIVELY_MULTIPLAYER)) return true;
  if (genres.has(STEAM_GENRE.SPORTS)) return true;
  return cats.has(STEAM_CATEGORY.MULTI_PLAYER) && !cats.has(STEAM_CATEGORY.SINGLE_PLAYER);
}
