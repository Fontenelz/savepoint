import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HttpCacheService } from '../core/http-cache.service';
import { USER_AGENT } from '../core/media.service';
import { PrismaService } from '../core/prisma.service';
import { IgdbProvider } from './providers/igdb.provider';
import { SteamStoreClient, plainText } from './providers/steam-store.client';

export interface DetailsResult {
  slug: string;
  title: string;
  steamAppId: boolean;
  avgHours: boolean;
  /** De onde veio a sinopse em português (null = mantida). */
  summary: 'steam' | 'wikipedia' | null;
}

/** Resumo da Wikipedia: até ~600 caracteres, cortando no fim de uma frase. */
function shortExtract(text: string) {
  if (text.length <= 600) return text;
  const cut = text.slice(0, 600);
  const end = cut.lastIndexOf('. ');
  return end > 200 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}

/**
 * Completa jogos que têm id do IGDB com dados de outras fontes abertas:
 * - app id da Steam e tempo médio para zerar (IGDB);
 * - sinopse em português para jogos importados do IGDB (que vêm em inglês):
 *   loja da Steam primeiro (texto curto) e, sem ela, o resumo da Wikipedia em português
 *   (o artigo é achado pelo Wikidata, que guarda o slug do IGDB na propriedade P5794).
 * Nunca sobrescreve dados curados: só preenche o que está vazio, e só troca a sinopse
 * de jogos de origem IGDB.
 */
@Injectable()
export class CatalogDetailsService {
  private readonly logger = new Logger(CatalogDetailsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly igdb: IgdbProvider,
    private readonly store: SteamStoreClient,
    private readonly cache: HttpCacheService,
  ) {}

  isEnabled() {
    return this.igdb.isEnabled();
  }

  async enrich(
    opts: { gameIds?: string[]; onProgress?: (r: DetailsResult, i: number, total: number) => void } = {},
  ): Promise<DetailsResult[]> {
    const games = await this.prisma.game.findMany({
      where: { igdbId: { not: null }, ...(opts.gameIds ? { id: { in: opts.gameIds } } : {}) },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        source: true,
        summary: true,
        igdbId: true,
        steamAppId: true,
        wikidataId: true,
        avgHours: true,
      },
    });
    if (!games.length) return [];

    const details = await this.igdb.details(games.map((g) => g.igdbId!));
    const needsWiki = games.filter((g) => g.source === 'IGDB' || !g.wikidataId);
    const wiki = await this.wikiArticles(
      needsWiki.map((g) => details.get(g.igdbId!)?.slug).filter((s): s is string => Boolean(s)),
    );
    const usedSteam = new Set(
      (
        await this.prisma.game.findMany({ where: { steamAppId: { not: null } }, select: { steamAppId: true } })
      ).map((g) => g.steamAppId!),
    );

    const results: DetailsResult[] = [];
    for (const [i, g] of games.entries()) {
      const d = details.get(g.igdbId!);
      const w = d ? wiki.get(d.slug) : undefined;
      const data: Prisma.GameUpdateInput = {};
      const result: DetailsResult = { slug: g.slug, title: g.title, steamAppId: false, avgHours: false, summary: null };

      // Um app id por jogo: se outro jogo já usa (ex.: criado pela importação da Steam), não duplica.
      let steamAppId = g.steamAppId;
      if (!steamAppId && d?.steamAppId && !usedSteam.has(d.steamAppId)) {
        steamAppId = data.steamAppId = d.steamAppId;
        usedSteam.add(d.steamAppId);
        result.steamAppId = true;
      }
      if (g.avgHours == null && d?.hours) {
        data.avgHours = d.hours;
        result.avgHours = true;
      }
      if (!g.wikidataId && w) data.wikidataId = w.qid;

      if (g.source === 'IGDB') {
        try {
          const store = steamAppId ? await this.store.appDetails(steamAppId) : null;
          const fromStore = plainText(store?.short_description);
          const fromWiki = !fromStore && w?.ptTitle ? await this.ptSummary(w.ptTitle) : null;
          const summary = fromStore ?? fromWiki;
          if (summary && summary !== g.summary) {
            data.summary = summary;
            result.summary = fromStore ? 'steam' : 'wikipedia';
          }
        } catch (e) {
          this.logger.warn(`Sinopse de ${g.title}: ${e instanceof Error ? e.message : e}`);
        }
      }

      if (Object.keys(data).length) await this.prisma.game.update({ where: { id: g.id }, data });
      results.push(result);
      opts.onProgress?.(result, i, games.length);
    }
    return results;
  }

  /** slug do IGDB → item do Wikidata e título do artigo na Wikipedia em português (lotes de 100). */
  private async wikiArticles(slugs: string[]) {
    const out = new Map<string, { qid: string; ptTitle: string | null }>();
    for (let i = 0; i < slugs.length; i += 100) {
      const values = slugs
        .slice(i, i + 100)
        .map((s) => JSON.stringify(s))
        .join(' ');
      const query =
        `SELECT ?slug ?item ?pt WHERE { VALUES ?slug { ${values} } ?item wdt:P5794 ?slug . ` +
        `OPTIONAL { ?a schema:about ?item ; schema:isPartOf <https://pt.wikipedia.org/> ; schema:name ?pt } }`;
      type Sparql = { results: { bindings: { slug: { value: string }; item: { value: string }; pt?: { value: string } }[] } };
      const data = await this.json<Sparql>(
        `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
        { accept: 'application/sparql-results+json' },
      );
      for (const b of data?.results.bindings ?? []) {
        if (out.has(b.slug.value)) continue;
        out.set(b.slug.value, { qid: b.item.value.split('/').pop()!, ptTitle: b.pt?.value ?? null });
      }
    }
    return out;
  }

  private async ptSummary(title: string) {
    const data = await this.json<{ type?: string; extract?: string }>(
      `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    );
    // Páginas de desambiguação não descrevem o jogo.
    if (!data?.extract || data.type === 'disambiguation') return null;
    const text = plainText(data.extract);
    return text ? shortExtract(text) : null;
  }

  /** GET JSON com cache de 30 dias; null em qualquer falha (enriquecimento é sempre opcional). */
  private async json<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
    const cached = await this.cache.get<T>(url);
    if (cached) return cached;
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, ...headers },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        this.logger.warn(`${new URL(url).host} respondeu ${res.status}`);
        return null;
      }
      const body = (await res.json()) as T;
      await this.cache.set(url, body).catch(() => undefined);
      return body;
    } catch {
      return null;
    }
  }
}
