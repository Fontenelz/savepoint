import type { GameSummary, ListSummary, Paginated } from '@savepoint/shared';
import type { MetadataRoute } from 'next';
import { publicApi } from '@/lib/public-api';
import { SITE_URL } from '@/lib/site';

// Gerado a cada pedido (listas são conteúdo de usuário: nada de cache).
export const dynamic = 'force-dynamic';

/** Percorre todas as páginas de um endpoint paginado da API (com um teto de segurança). */
async function all<T>(path: string, maxPages = 200): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const data = await publicApi<Paginated<T>>(`${path}${sep}page=${page}`);
    if (!data) break;
    out.push(...data.items);
    if (page >= data.totalPages) break;
  }
  return out;
}

/** Home, catálogo, listas, todos os jogos e listas públicas. Perfis ficam de fora de propósito. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [games, lists] = await Promise.all([all<GameSummary>('/games?sort=title'), all<ListSummary>('/lists')]);
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/games`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/lists`, changeFrequency: 'daily', priority: 0.6 },
    ...games.map((g) => ({ url: `${SITE_URL}/games/${g.slug}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...lists.map((l) => ({
      url: `${SITE_URL}/lists/${l.id}`,
      lastModified: l.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ];
}
