import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpCacheService } from '../../core/http-cache.service';
import { USER_AGENT } from '../../core/media.service';
import type { ArtworkCandidate, ArtworkLookup, ArtworkSource } from './artwork-source';
import { normalizeTitle } from './catalog-provider';

type Claims = Record<string, { rank: string; mainsnak: { datavalue?: { value: unknown } } }[]>;

interface WikiPage {
  title: string;
  index?: number;
  pageprops?: { wikibase_item?: string };
  original?: { source: string };
}

/** Intervalo entre chamadas à Wikimedia (as APIs públicas pedem clientes "bem-comportados"). */
const MIN_INTERVAL_MS = 1500;
const MAX_RETRIES = 6;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ordem de tentativa dos CDNs da Steam (redes corporativas costumam bloquear só alguns). */
export const STEAM_HOSTS = [
  'steamcdn-a.akamaihd.net',
  'cdn.cloudflare.steamstatic.com',
  'cdn.akamai.steamstatic.com',
  'shared.cloudflare.steamstatic.com',
  'cdn.fastly.steamstatic.com',
];

/** Propriedades do Wikidata que indicam que a entidade é um jogo. */
const GAME_HINTS = ['P400' /* plataforma */, 'P1733' /* Steam app id */, 'P5794' /* IGDB id */, 'P404' /* modo de jogo */];

/**
 * Fonte aberta, sem chave de API:
 *   Wikipedia (acha a página do jogo) → Wikidata (Steam app id) → capas/banners da Steam.
 * Jogos fora da Steam (exclusivos de console) ficam com a capa da própria Wikipedia.
 * Desative com ARTWORK_WIKI_STEAM=false.
 */
@Injectable()
export class WikiSteamSource implements ArtworkSource {
  readonly id = 'wiki-steam';
  readonly name = 'Wikipedia + Steam';
  private readonly logger = new Logger(WikiSteamSource.name);

  private lastRequest = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly cache: HttpCacheService,
  ) {}

  isEnabled() {
    return this.config.get<string>('ARTWORK_WIKI_STEAM') !== 'false';
  }

  async findArtwork(game: ArtworkLookup): Promise<ArtworkCandidate | null> {
    const page = await this.findPage(game);
    if (!page) return null;

    const steamIds = game.steamAppId ? [game.steamAppId] : this.values(page.claims, 'P1733');
    const covers = [
      ...steamIds.flatMap((id) => STEAM_HOSTS.map((h) => `https://${h}/steam/apps/${id}/library_600x900_2x.jpg`)),
      ...steamIds.flatMap((id) => STEAM_HOSTS.map((h) => `https://${h}/steam/apps/${id}/library_600x900.jpg`)),
      ...(page.image ? [page.image] : []),
    ];
    // A capa de jogo costuma ser imagem "não livre", que a busca acima omite; o resumo REST a inclui.
    if (!page.image) {
      const summary = await this.json<{ originalimage?: { source: string } }>(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
      );
      const img = summary?.originalimage?.source?.split('?')[0];
      if (img) covers.push(img);
    }
    const backdrops = steamIds.flatMap((id) => STEAM_HOSTS.map((h) => `https://${h}/steam/apps/${id}/library_hero.jpg`));

    return {
      source: this.name,
      matchedTitle: page.title,
      covers,
      backdrops,
      refs: { wikidataId: page.qid, ...(steamIds[0] ? { steamAppId: steamIds[0] } : {}) },
    };
  }

  /**
   * Encontra a página da Wikipedia (em inglês, onde as infoboxes de jogos são mais completas).
   * Uma única chamada traz candidatos + ID do Wikidata + imagem da infobox.
   */
  private async findPage(game: ArtworkLookup) {
    const params = game.wikidataId
      ? await this.titleForEntity(game.wikidataId).then((t) => (t ? `titles=${encodeURIComponent(t)}` : null))
      : `generator=search&gsrsearch=${encodeURIComponent(`${game.title} video game`)}&gsrlimit=10`;
    if (!params) return null;

    const data = await this.json<{ query?: { pages?: WikiPage[] } }>(
      `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1` +
        `&prop=pageprops|pageimages&ppprop=wikibase_item&piprop=original&pilicense=any&${params}`,
    );
    const pages = (data?.query?.pages ?? []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const ranked = game.wikidataId ? pages : this.rank(pages, game.title, game.releaseYear);

    for (const page of ranked) {
      const qid = page.pageprops?.wikibase_item;
      if (!qid) continue;
      const claims = await this.claims(qid);
      if (!claims || !GAME_HINTS.some((p) => claims[p]?.length)) continue; // não é um jogo
      return { title: page.title, qid, claims, image: page.original?.source ?? null };
    }
    return null;
  }

  /** Ordena candidatos: "Hades (video game)" > "Hades"; "God of War (2018 video game)" > "God of War". */
  private rank(pages: WikiPage[], title: string, year: number | null): WikiPage[] {
    const wanted = normalizeTitle(title);
    const scored: { page: WikiPage; score: number }[] = [];
    for (const page of pages) {
      const m = page.title.match(/^(.*?)\s*\(([^)]*)\)$/);
      const base = normalizeTitle(m ? m[1] : page.title);
      const qualifier = (m?.[2] ?? '').toLowerCase();
      if (qualifier && !qualifier.includes('video game') && !/^\d{4}$/.test(qualifier)) continue; // filme, série...

      let score: number;
      if (base === wanted) score = 50;
      else if (wanted.startsWith(base) && base.length >= 5) score = 5; // "Mario Kart 8" para "Mario Kart 8 Deluxe"
      else continue;
      if (qualifier.includes('video game')) score += 20;
      if (year && qualifier.includes(String(year))) score += 30;
      scored.push({ page, score });
    }
    return scored.sort((a, b) => b.score - a.score).map((s) => s.page);
  }

  private async titleForEntity(qid: string) {
    const data = await this.json<{ entities?: Record<string, { sitelinks?: { enwiki?: { title: string } } }> }>(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=sitelinks&sitefilter=enwiki&format=json`,
    );
    return data?.entities?.[qid]?.sitelinks?.enwiki?.title ?? null;
  }

  private async claims(qid: string): Promise<Claims | null> {
    const data = await this.json<{ entities?: Record<string, { claims?: Claims }> }>(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json`,
    );
    return data?.entities?.[qid]?.claims ?? null;
  }

  /** Valores string de uma propriedade, com rank "preferred" primeiro e sem os "deprecated". */
  private values(claims: Claims, prop: string): string[] {
    return (claims[prop] ?? [])
      .filter((c) => c.rank !== 'deprecated')
      .sort((a, b) => (a.rank === 'preferred' ? -1 : 0) - (b.rank === 'preferred' ? -1 : 0))
      .map((c) => c.mainsnak.datavalue?.value)
      .filter((v): v is string => typeof v === 'string');
  }

  /**
   * GET JSON respeitando os limites da Wikimedia: intervalo mínimo entre chamadas
   * e, ao receber 429, espera o Retry-After antes de tentar de novo.
   */
  private async json<T>(url: string, attempt = 0): Promise<T | null> {
    // Respostas já consultadas vêm do disco: nenhuma chamada de rede.
    const cached = await this.cache.get<T>(url);
    if (cached !== undefined) return cached;

    const wait = this.lastRequest + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastRequest = Date.now();
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, 'api-user-agent': USER_AGENT },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 429 && attempt < MAX_RETRIES) {
        // Espera crescente (5s, 10s, 20s...) ou o que o servidor pedir.
        const retryAfter = Number(res.headers.get('retry-after')) || Math.min(60, 5 * 2 ** attempt);
        this.logger.warn(`Limite da Wikimedia atingido; aguardando ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        return this.json<T>(url, attempt + 1);
      }
      if (!res.ok) return null;
      const body = (await res.json()) as T;
      await this.cache.set(url, body);
      return body;
    } catch (e) {
      this.logger.debug(`Falhou ${url}: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }
}
