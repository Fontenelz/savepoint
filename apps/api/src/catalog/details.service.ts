import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HttpCacheService } from '../core/http-cache.service';
import { USER_AGENT } from '../core/media.service';
import { PrismaService } from '../core/prisma.service';
import { canonicalGenre, canonicalPlatform } from './taxonomy';
import { IgdbProvider, type IgdbDetails } from './providers/igdb.provider';
import { SteamStoreClient, looksPortuguese, plainText } from './providers/steam-store.client';

export interface DetailsResult {
  slug: string;
  title: string;
  steamAppId: boolean;
  avgHours: boolean;
  /** De onde veio a sinopse em português (null = mantida). */
  summary: 'steam' | 'wikipedia' | null;
}

/** Origens cuja sinopse vem em inglês e pode ser trocada pela versão em português. */
const IMPORTED = new Set<string>(['IGDB', 'RAWG']);

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


  async enrich(
    opts: { gameIds?: string[]; onProgress?: (r: DetailsResult, i: number, total: number) => void } = {},
  ): Promise<DetailsResult[]> {
    const games = await this.prisma.game.findMany({
      where: {
        OR: [{ igdbId: { not: null } }, { rawgId: { not: null } }],
        ...(opts.gameIds ? { id: { in: opts.gameIds } } : {}),
      },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        source: true,
        summary: true,
        igdbId: true,
        rawgId: true,
        steamAppId: true,
        wikidataId: true,
        avgHours: true,
      },
    });
    if (!games.length) return [];

    // IGDB: app id da Steam e tempo para zerar (só com as chaves configuradas).
    const igdbIds = games.map((g) => g.igdbId).filter((id): id is string => Boolean(id));
    const details = this.igdb.isEnabled() && igdbIds.length ? await this.igdb.details(igdbIds) : new Map<string, IgdbDetails>();
    // Wikidata guarda o slug do IGDB (P5794) e o da RAWG (P9968): os dois levam ao artigo em português.
    const needsWiki = games.filter((g) => IMPORTED.has(g.source) || !g.wikidataId);
    const byIgdb = await this.wikiArticles(
      'P5794',
      needsWiki.map((g) => (g.igdbId ? details.get(g.igdbId)?.slug : undefined)).filter((s): s is string => Boolean(s)),
    );
    const byRawg = await this.wikiArticles(
      'P9968',
      needsWiki.map((g) => g.rawgId).filter((s): s is string => Boolean(s)),
    );
    const usedSteam = new Set(
      (
        await this.prisma.game.findMany({ where: { steamAppId: { not: null } }, select: { steamAppId: true } })
      ).map((g) => g.steamAppId!),
    );

    const results: DetailsResult[] = [];
    for (const [i, g] of games.entries()) {
      const d = g.igdbId ? details.get(g.igdbId) : undefined;
      const w = (d ? byIgdb.get(d.slug) : undefined) ?? (g.rawgId ? byRawg.get(g.rawgId) : undefined);
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

      if (IMPORTED.has(g.source)) {
        try {
          const store = steamAppId ? await this.store.appDetails(steamAppId) : null;
          // Sem tradução, a loja manda o texto em inglês: nesse caso tenta a Wikipedia.
          const storeText = plainText(store?.short_description);
          const fromStore = storeText && looksPortuguese(storeText) ? storeText : null;
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

  /**
   * Avaliações da loja da Steam (% positivas e total) de todo jogo com app id: base da nota
   * sugerida aos jogadores. Só os que ainda não têm, ou todos com `refresh`.
   */
  async fillSteamScores(
    opts: { refresh?: boolean; onProgress?: (title: string, score: number | null, i: number, total: number) => void } = {},
  ): Promise<{ filled: number; total: number }> {
    const games = await this.prisma.game.findMany({
      where: { steamAppId: { not: null }, ...(opts.refresh ? {} : { steamScore: null }) },
      orderBy: { title: 'asc' },
      select: { id: true, title: true, steamAppId: true },
    });
    let filled = 0;
    for (const [i, g] of games.entries()) {
      let score: number | null = null;
      try {
        const summary = await this.store.reviewSummary(g.steamAppId!);
        if (summary) {
          await this.prisma.game.update({
            where: { id: g.id },
            data: { steamScore: summary.score, steamReviewCount: summary.total },
          });
          score = summary.score;
          filled++;
        }
      } catch (e) {
        this.logger.warn(`Avaliações Steam de ${g.title}: ${e instanceof Error ? e.message : e}`);
      }
      opts.onProgress?.(g.title, score, i, games.length);
    }
    return { filled, total: games.length };
  }

  /**
   * Junta gêneros duplicados criados por importações antigas (ex.: "Adventure" → "Aventura")
   * e remove categorias que não são gênero ("Gratuitos para Jogar", "Acesso Antecipado").
   */
  async normalizeGenres(): Promise<{ merged: string[]; removed: string[] }> {
    const merged: string[] = [];
    const removed: string[] = [];
    const genres = await this.prisma.genre.findMany({ select: { id: true, slug: true, name: true } });
    for (const g of genres) {
      const target = canonicalGenre(g.name, g.slug);
      if (target?.slug === g.slug) continue;
      if (target) {
        const into = await this.prisma.genre.upsert({
          where: { slug: target.slug },
          create: target,
          update: {},
          select: { id: true },
        });
        const games = await this.prisma.game.findMany({ where: { genres: { some: { id: g.id } } }, select: { id: true } });
        for (const game of games) {
          await this.prisma.game.update({ where: { id: game.id }, data: { genres: { connect: { id: into.id } } } });
        }
        merged.push(`${g.name} → ${target.name} (${games.length})`);
      } else {
        removed.push(g.name);
      }
      // A ligação jogo–gênero (tabela implícita) é apagada junto.
      await this.prisma.genre.delete({ where: { id: g.id } });
    }
    return { merged, removed };
  }

  /** Junta plataformas duplicadas (ex.: "macOS" → "Mac", "Android"/"iOS" → "iOS / Android"). */
  async normalizePlatforms(): Promise<string[]> {
    const merged: string[] = [];
    const platforms = await this.prisma.platform.findMany({ select: { id: true, slug: true, name: true, short: true } });
    for (const p of platforms) {
      const target = canonicalPlatform(p);
      if (!target || target.slug === p.slug) continue;
      const into = await this.prisma.platform.upsert({
        where: { slug: target.slug },
        create: target,
        update: {},
        select: { id: true },
      });
      const games = await this.prisma.game.findMany({ where: { platforms: { some: { id: p.id } } }, select: { id: true } });
      for (const game of games) {
        await this.prisma.game.update({ where: { id: game.id }, data: { platforms: { connect: { id: into.id } } } });
      }
      // Estante e diário guardam a plataforma em que a pessoa jogou: aponta para a canônica.
      await this.prisma.userGame.updateMany({ where: { platformId: p.id }, data: { platformId: into.id } });
      await this.prisma.logEntry.updateMany({ where: { platformId: p.id }, data: { platformId: into.id } });
      await this.prisma.platform.delete({ where: { id: p.id } });
      merged.push(`${p.name} → ${target.name} (${games.length})`);
    }
    return merged;
  }

  /** slug (IGDB ou RAWG) → item do Wikidata e título do artigo na Wikipedia em português (lotes de 100). */
  private async wikiArticles(property: 'P5794' | 'P9968', slugs: string[]) {
    const out = new Map<string, { qid: string; ptTitle: string | null }>();
    for (let i = 0; i < slugs.length; i += 100) {
      const values = slugs
        .slice(i, i + 100)
        .map((s) => JSON.stringify(s))
        .join(' ');
      const query =
        `SELECT ?slug ?item ?pt WHERE { VALUES ?slug { ${values} } ?item wdt:${property} ?slug . ` +
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
