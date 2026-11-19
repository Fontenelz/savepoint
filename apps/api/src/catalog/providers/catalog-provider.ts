/**
 * Contrato de uma fonte externa de catálogo.
 * O app NUNCA lê jogos diretamente daqui em tempo de navegação: um provider só é usado
 * para buscar e importar/enriquecer (copiar) jogos no banco local, que é a fonte da verdade.
 */
export interface ExternalGame {
  externalId: string;
  title: string;
  summary: string | null;
  releaseYear: number | null;
  developer: string | null;
  publisher: string | null;
  coverUrl: string | null;
  backdropUrl: string | null;
  avgHours: number | null;
  genres: string[];
  platforms: { name: string; short: string }[];
}

export interface CatalogProvider {
  readonly id: 'igdb';
  readonly name: string;
  isEnabled(): boolean;
  search(query: string): Promise<ExternalGame[]>;
  fetch(externalId: string): Promise<ExternalGame | null>;
  /** Encontra o jogo que corresponde a um título/ano do catálogo local (ou null). */
  findMatch(title: string, year: number | null): Promise<ExternalGame | null>;
}

export const CATALOG_PROVIDERS = Symbol('CATALOG_PROVIDERS');

/** "The Legend of Zelda: Breath of the Wild" → "legendofzeldabreathofthewild" */
export function normalizeTitle(title: string) {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Pontua o quanto um resultado externo corresponde ao jogo local.
 * Título igual vale mais; ano igual desempata remakes (RE4 2005 × 2023).
 */
export function matchScore(local: { title: string; year: number | null }, ext: ExternalGame) {
  const a = normalizeTitle(local.title);
  const b = normalizeTitle(ext.title);
  let score = 0;
  if (a === b) score += 100;
  else if (b.startsWith(a) || a.startsWith(b)) score += 40;
  else return 0;
  if (local.year && ext.releaseYear) {
    const diff = Math.abs(local.year - ext.releaseYear);
    if (diff === 0) score += 50;
    else if (diff === 1) score += 30;
    else score -= Math.min(60, diff * 5);
  }
  if (ext.coverUrl) score += 5;
  return score;
}
