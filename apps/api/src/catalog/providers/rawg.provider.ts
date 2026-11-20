import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { USER_AGENT } from '../../core/media.service';
import type { ExternalGame } from './catalog-provider';

interface RawgListGame {
  id: number;
  slug: string;
  name: string;
}

interface RawgGame extends RawgListGame {
  released: string | null;
  description_raw?: string;
  background_image: string | null;
  /** Média de horas jogadas pelos usuários da RAWG (não é "tempo para zerar"). */
  playtime: number;
  developers?: { name: string }[];
  publishers?: { name: string }[];
  genres?: { name: string }[];
  platforms?: { platform: { name: string } }[] | null;
}

export interface RawgImport {
  ext: ExternalGame;
  slug: string;
  steamAppId: string | null;
  /** Fallback para o tempo médio quando não há dado melhor. */
  playtime: number | null;
}

/** Nomes de plataforma da RAWG → abreviação usada no catálogo (casa com as plataformas existentes). */
const PLATFORM_SHORT: Record<string, string> = {
  PC: 'PC',
  'PlayStation 5': 'PS5',
  'PlayStation 4': 'PS4',
  'PlayStation 3': 'PS3',
  'Xbox Series S/X': 'XSX',
  'Xbox One': 'XONE',
  'Xbox 360': 'X360',
  'Nintendo Switch': 'Switch',
  'Wii U': 'Wii U',
  SNES: 'SNES',
  iOS: 'Mobile',
  Android: 'Mobile',
};

const MIN_INTERVAL_MS = 250;
const PAGE_SIZE = 40; // máximo da API

/**
 * RAWG (rawg.io): segunda fonte para importação em massa. Opcional, com RAWG_API_KEY.
 * Termos: uso não comercial e link para a RAWG em toda página que mostra os dados (rodapé do site).
 * A RAWG não tem capa vertical: a imagem dela vira o banner e a capa vem das outras fontes.
 */
@Injectable()
export class RawgProvider {
  readonly id = 'rawg' as const;
  readonly name = 'RAWG';
  private readonly logger = new Logger(RawgProvider.name);
  private lastRequest = 0;

  constructor(private readonly config: ConfigService) {}

  private get key() {
    return this.config.get<string>('RAWG_API_KEY') ?? '';
  }

  isEnabled() {
    return Boolean(this.key);
  }

  /** Jogos mais adicionados às bibliotecas dos usuários da RAWG, sem DLCs e edições. */
  async popular(limit: number, offset = 0): Promise<RawgListGame[]> {
    const out: RawgListGame[] = [];
    let page = Math.floor(offset / PAGE_SIZE) + 1;
    let skip = offset % PAGE_SIZE;
    while (out.length < limit) {
      const data = await this.request<{ results: RawgListGame[]; next: string | null }>('games', {
        ordering: '-added',
        exclude_additions: 'true',
        page_size: String(PAGE_SIZE),
        page: String(page),
      });
      out.push(...data.results.slice(skip, skip + (limit - out.length)));
      skip = 0;
      if (!data.next) break;
      page++;
    }
    return out;
  }

  /** Detalhes completos + app id da Steam (pela lista de lojas). */
  async fetch(idOrSlug: string): Promise<RawgImport | null> {
    const g = await this.request<RawgGame>(`games/${encodeURIComponent(idOrSlug)}`, {}).catch(() => null);
    if (!g) return null;
    const stores = await this.request<{ results: { store_id: number; url: string }[] }>(
      `games/${g.id}/stores`,
      {},
    ).catch(() => ({ results: [] }));
    const steamAppId =
      stores.results.map((s) => /store\.steampowered\.com\/app\/(\d+)/.exec(s.url)?.[1]).find(Boolean) ?? null;

    const ext: ExternalGame = {
      externalId: String(g.id),
      title: g.name,
      summary: g.description_raw?.trim().slice(0, 2000) || null,
      releaseYear: g.released ? Number(g.released.slice(0, 4)) : null,
      developer: g.developers?.[0]?.name ?? null,
      publisher: g.publishers?.[0]?.name ?? null,
      coverUrl: null,
      backdropUrl: g.background_image,
      avgHours: null,
      genres: (g.genres ?? []).map((x) => x.name),
      platforms: (g.platforms ?? []).map(({ platform: p }) => ({ name: p.name, short: PLATFORM_SHORT[p.name] ?? p.name })),
    };
    return { ext, slug: g.slug, steamAppId, playtime: g.playtime > 0 ? g.playtime : null };
  }

  private async request<T>(path: string, query: Record<string, string>, attempt = 0): Promise<T> {
    if (!this.isEnabled()) throw new ServiceUnavailableException('RAWG não configurada');
    const wait = this.lastRequest + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequest = Date.now();

    const url = `https://api.rawg.io/api/${path}?${new URLSearchParams({ key: this.key, ...query })}`;
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      return this.request<T>(path, query, attempt + 1);
    }
    if (!res.ok) {
      // Nunca registrar a URL: ela contém a chave.
      this.logger.warn(`RAWG ${path} respondeu ${res.status}`);
      throw new ServiceUnavailableException('A RAWG não respondeu. Tente novamente mais tarde.');
    }
    return (await res.json()) as T;
  }
}
