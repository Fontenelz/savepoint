import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ArtworkCandidate, ArtworkLookup, ArtworkSource } from './artwork-source';
import { matchScore, type CatalogProvider, type ExternalGame } from './catalog-provider';

interface IgdbImage {
  image_id: string;
}

interface IgdbGame {
  id: number;
  name: string;
  summary?: string;
  first_release_date?: number;
  cover?: IgdbImage;
  artworks?: IgdbImage[];
  screenshots?: IgdbImage[];
  genres?: { name: string }[];
  platforms?: { name: string; abbreviation?: string }[];
  involved_companies?: { developer: boolean; publisher: boolean; company: { name: string } }[];
}

const FIELDS =
  'fields name,summary,first_release_date,cover.image_id,artworks.image_id,screenshots.image_id,' +
  'genres.name,platforms.name,platforms.abbreviation,' +
  'involved_companies.developer,involved_companies.publisher,involved_companies.company.name;';

const image = (size: string, img?: IgdbImage) =>
  img ? `https://images.igdb.com/igdb/image/upload/${size}/${img.image_id}.jpg` : null;

/** `external_game_sources`: 1 = Steam. */
const STEAM_SOURCE = 1;

export interface IgdbDetails {
  slug: string;
  steamAppId: string | null;
  /** Tempo para zerar, em horas. */
  hours: number | null;
}

/** O IGDB limita a ~4 requisições/segundo por cliente. */
const MIN_INTERVAL_MS = 300;

/**
 * IGDB (Twitch). Opcional: só é habilitado com IGDB_CLIENT_ID e IGDB_CLIENT_SECRET.
 * Atenção: revise os termos de uso do IGDB antes de qualquer uso comercial.
 */
@Injectable()
export class IgdbProvider implements CatalogProvider, ArtworkSource {
  readonly id = 'igdb' as const;
  readonly name = 'IGDB';
  private readonly logger = new Logger(IgdbProvider.name);
  private token: { value: string; expiresAt: number } | null = null;
  private lastRequest = 0;

  constructor(private readonly config: ConfigService) {}

  private get clientId() {
    return this.config.get<string>('IGDB_CLIENT_ID') ?? '';
  }

  private get clientSecret() {
    return this.config.get<string>('IGDB_CLIENT_SECRET') ?? '';
  }

  isEnabled() {
    return Boolean(this.clientId && this.clientSecret);
  }

  async search(query: string): Promise<ExternalGame[]> {
    const safe = query.replace(/["\\]/g, '');
    const rows = await this.request(`search "${safe}"; ${FIELDS} where version_parent = null; limit 15;`);
    return rows.map((r) => this.map(r));
  }

  /**
   * Jogos mais populares (por número de avaliações), só jogos "principais":
   * sem versões/edições (version_parent) e sem DLCs/expansões (parent_game).
   */
  async popular(limit: number, offset = 0): Promise<ExternalGame[]> {
    const rows = await this.request(
      `${FIELDS} where version_parent = null & parent_game = null & cover != null & total_rating_count > 0; ` +
        `sort total_rating_count desc; limit ${Math.min(limit, 500)}; offset ${offset};`,
    );
    return rows.map((r) => this.map(r));
  }

  /**
   * Dados complementares de vários jogos de uma vez (lotes de 500):
   * slug do IGDB, app id da Steam e tempo médio para zerar (horas).
   */
  async details(ids: string[]): Promise<Map<string, IgdbDetails>> {
    const out = new Map<string, IgdbDetails>();
    const valid = ids.filter((id) => /^\d+$/.test(id));
    for (let i = 0; i < valid.length; i += 500) {
      const list = valid.slice(i, i + 500).join(',');
      const [games, steam, times] = [
        await this.request<{ id: number; slug: string }>(`fields slug; where id = (${list}); limit 500;`),
        await this.request<{ game: number; uid: string }>(
          `fields game,uid; where game = (${list}) & external_game_source = ${STEAM_SOURCE}; limit 500;`,
          'external_games',
        ),
        await this.request<{ game_id: number; hastily?: number; normally?: number }>(
          `fields game_id,hastily,normally; where game_id = (${list}); limit 500;`,
          'game_time_to_beats',
        ),
      ];
      for (const g of games) out.set(String(g.id), { slug: g.slug, steamAppId: null, hours: null });
      // Um jogo do IGDB pode ter vários ids da Steam (demo, pacote, relançamento): fica o menor,
      // que é a página original (ex.: Portal = 400, não 52003).
      for (const s of steam) {
        const d = out.get(String(s.game));
        if (!d || !/^\d+$/.test(s.uid)) continue;
        if (!d.steamAppId || Number(s.uid) < Number(d.steamAppId)) d.steamAppId = s.uid;
      }
      for (const t of times) {
        const d = out.get(String(t.game_id));
        // "Rápido" ≈ só a história; "normal" já inclui muito conteúdo extra. A média geométrica dos
        // dois fica perto dos tempos do catálogo curado (ex.: Witcher 3: 37h e 71h → 51,5h; curado: 52h).
        // Dados contraditórios (rápido > normal, ex.: Vice City com 876h × 134h) são descartados.
        if (t.hastily && t.normally && t.hastily > t.normally) continue;
        const seconds = t.hastily && t.normally ? Math.sqrt(t.hastily * t.normally) : t.hastily || t.normally;
        // Arredonda para meia hora (mesma granularidade do catálogo curado).
        if (d && seconds) d.hours = Math.max(0.5, Math.round((seconds / 3600) * 2) / 2);
      }
    }
    return out;
  }

  async fetch(externalId: string): Promise<ExternalGame | null> {
    if (!/^\d+$/.test(externalId)) return null;
    const rows = await this.request(`${FIELDS} where id = ${externalId};`);
    return rows[0] ? this.map(rows[0]) : null;
  }

  async findMatch(title: string, year: number | null): Promise<ExternalGame | null> {
    const results = await this.search(title);
    let best: { game: ExternalGame; score: number } | null = null;
    for (const game of results) {
      const score = matchScore({ title, year }, game);
      if (score > 0 && (!best || score > best.score)) best = { game, score };
    }
    // Abaixo de 100 o título nem bate exatamente: melhor não arriscar uma capa errada.
    return best && best.score >= 100 ? best.game : null;
  }

  async findArtwork(game: ArtworkLookup): Promise<ArtworkCandidate | null> {
    const ext = game.igdbId ? await this.fetch(game.igdbId) : await this.findMatch(game.title, game.releaseYear);
    if (!ext) return null;
    return {
      source: this.name,
      matchedTitle: ext.title,
      covers: ext.coverUrl ? [ext.coverUrl] : [],
      backdrops: ext.backdropUrl ? [ext.backdropUrl] : [],
      refs: { igdbId: ext.externalId },
      developer: ext.developer,
      publisher: ext.publisher,
    };
  }

  private map(g: IgdbGame): ExternalGame {
    const companies = g.involved_companies ?? [];
    return {
      externalId: String(g.id),
      title: g.name,
      summary: g.summary ?? null,
      releaseYear: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
      developer: companies.find((c) => c.developer)?.company.name ?? null,
      publisher: companies.find((c) => c.publisher)?.company.name ?? null,
      coverUrl: image('t_cover_big_2x', g.cover),
      // Artwork oficial é a melhor opção para banner; screenshot é o plano B.
      backdropUrl: image('t_1080p', g.artworks?.[0] ?? g.screenshots?.[0]),
      avgHours: null,
      genres: (g.genres ?? []).map((x) => x.name),
      platforms: (g.platforms ?? []).map((p) => ({ name: p.name, short: p.abbreviation ?? p.name })),
    };
  }

  private async request<T = IgdbGame>(body: string, endpoint = 'games', attempt = 0): Promise<T[]> {
    if (!this.isEnabled()) throw new ServiceUnavailableException('IGDB não configurado');
    const wait = this.lastRequest + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequest = Date.now();

    const token = await this.getToken();
    const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: 'POST',
      headers: { 'Client-ID': this.clientId, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
      body,
    });

    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      return this.request<T>(body, endpoint, attempt + 1);
    }
    if (res.status === 401 && attempt < 1) {
      this.token = null; // token expirou: renova e tenta de novo
      return this.request<T>(body, endpoint, attempt + 1);
    }
    if (!res.ok) {
      this.logger.warn(`IGDB respondeu ${res.status}: ${await res.text().catch(() => '')}`);
      throw new ServiceUnavailableException('O IGDB não respondeu. Tente novamente mais tarde.');
    }
    return (await res.json()) as T[];
  }

  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'client_credentials',
    });
    const res = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, { method: 'POST' });
    if (!res.ok) throw new ServiceUnavailableException('Falha ao autenticar no IGDB (verifique as credenciais)');
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return this.token.value;
  }
}
