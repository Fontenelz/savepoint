/**
 * Fonte de arte (capas/banners) para enriquecer jogos do catálogo local.
 * Diferente do CatalogProvider (que importa jogos inteiros), uma ArtworkSource só
 * encontra imagens e IDs externos para um jogo que já existe aqui.
 */
export interface ArtworkLookup {
  title: string;
  releaseYear: number | null;
  igdbId: string | null;
  wikidataId: string | null;
  steamAppId: string | null;
}

export interface ArtworkCandidate {
  source: string;
  matchedTitle: string;
  /** URLs em ordem de preferência (o mesmo arquivo em CDNs diferentes conta como alternativa). */
  covers: string[];
  backdrops: string[];
  refs: { igdbId?: string; wikidataId?: string; steamAppId?: string };
  developer?: string | null;
  publisher?: string | null;
}

export interface ArtworkSource {
  readonly id: string;
  readonly name: string;
  isEnabled(): boolean;
  findArtwork(game: ArtworkLookup): Promise<ArtworkCandidate | null>;
}

export const ARTWORK_SOURCES = Symbol('ARTWORK_SOURCES');
