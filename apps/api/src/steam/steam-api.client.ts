import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpCacheService } from '../core/http-cache.service';
import { USER_AGENT } from '../core/media.service';

export const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
/** Campos que a Steam precisa ter assinado para a resposta valer. */
const REQUIRED_SIGNED = ['claimed_id', 'identity', 'return_to', 'response_nonce', 'assoc_handle'];

export interface SteamOwnedGame {
  appid: number;
  name?: string;
  /** Minutos jogados no total. */
  playtime_forever: number;
  /** Minutos jogados nas últimas 2 semanas (só vem quando > 0). */
  playtime_2weeks?: number;
  /** Último jogo, em segundos Unix (0 = nunca). */
  rtime_last_played?: number;
}

export interface SteamPlayer {
  name: string | null;
  avatarUrl: string | null;
  profileUrl: string;
}

export interface SteamAppDetails {
  type: string;
  name: string;
  short_description?: string;
  developers?: string[];
  publishers?: string[];
  release_date?: { coming_soon: boolean; date: string };
  genres?: { id: string; description: string }[];
}

/**
 * Cliente das APIs da Steam:
 * - OpenID 2.0 (login na Steam → SteamID), sem chave;
 * - Steam Web API (perfil e biblioteca), com STEAM_API_KEY;
 * - API da loja (dados do jogo, em português), sem chave e com cache.
 */
@Injectable()
export class SteamApiClient {
  private readonly logger = new Logger(SteamApiClient.name);
  /** Biblioteca recente por SteamID: a importação em lotes não repete a chamada a cada lote. */
  private readonly ownedCache = new Map<string, { at: number; value: { private: boolean; games: SteamOwnedGame[] } }>();

  constructor(
    private readonly config: ConfigService,
    private readonly cache: HttpCacheService,
  ) {}

  private get key() {
    return this.config.get<string>('STEAM_API_KEY') ?? '';
  }

  isEnabled() {
    return Boolean(this.key);
  }

  /** Confirma com a própria Steam que a resposta do login é autêntica e devolve o SteamID64. */
  async verifyOpenId(params: Record<string, string>): Promise<string> {
    const invalid = () => new BadRequestException('Resposta de login da Steam inválida. Tente conectar de novo.');
    if (params['openid.mode'] !== 'id_res') throw invalid();
    if (params['openid.op_endpoint'] !== STEAM_OPENID_ENDPOINT) throw invalid();
    const signed = (params['openid.signed'] ?? '').split(',');
    if (!REQUIRED_SIGNED.every((f) => signed.includes(f))) throw invalid();
    const claimed = CLAIMED_ID.exec(params['openid.claimed_id'] ?? '');
    if (!claimed || params['openid.identity'] !== params['openid.claimed_id']) throw invalid();

    const body = new URLSearchParams({ ...params, 'openid.mode': 'check_authentication' });
    let text: string;
    try {
      const res = await fetch(STEAM_OPENID_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      text = await res.text();
    } catch {
      throw new ServiceUnavailableException('A Steam não respondeu. Tente de novo em instantes.');
    }
    // A Steam só confirma cada resposta uma vez (o nonce não pode ser reutilizado).
    if (!/^is_valid:true$/m.test(text)) throw new UnauthorizedException('A Steam não confirmou o login. Tente de novo.');
    return claimed[1];
  }

  async player(steamId: string): Promise<SteamPlayer | null> {
    const data = await this.webApi<{ response: { players: { personaname?: string; avatarfull?: string; profileurl: string }[] } }>(
      'ISteamUser/GetPlayerSummaries/v2',
      { steamids: steamId },
    );
    const p = data.response.players[0];
    return p ? { name: p.personaname ?? null, avatarUrl: p.avatarfull ?? null, profileUrl: p.profileurl } : null;
  }

  /** Biblioteca da conta. `private` quando o perfil esconde os detalhes de jogos. */
  async ownedGames(steamId: string, opts: { fresh?: boolean } = {}) {
    const hit = this.ownedCache.get(steamId);
    if (hit && !opts.fresh && Date.now() - hit.at < 5 * 60_000) return hit.value;

    const data = await this.webApi<{ response: { game_count?: number; games?: SteamOwnedGame[] } }>(
      'IPlayerService/GetOwnedGames/v1',
      { steamid: steamId, include_appinfo: '1', include_played_free_games: '1' },
    );
    // Perfil privado: a Steam responde 200 com `response` vazio.
    const value = { private: data.response.game_count === undefined, games: data.response.games ?? [] };
    this.ownedCache.set(steamId, { at: Date.now(), value });
    return value;
  }

  /** Dados públicos da loja, em português. Respostas ficam em cache por 30 dias. */
  async appDetails(appId: string): Promise<SteamAppDetails | null> {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=brazilian&cc=br`;
    type Payload = Record<string, { success: boolean; data?: SteamAppDetails }>;
    let payload = await this.cache.get<Payload>(url);
    if (!payload) {
      let res: Response;
      try {
        res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(10_000) });
      } catch {
        throw new ServiceUnavailableException('A loja da Steam não respondeu.');
      }
      if (res.status === 429) throw new ServiceUnavailableException('Limite de consultas da loja da Steam. Tente em alguns minutos.');
      if (!res.ok) throw new ServiceUnavailableException(`A loja da Steam respondeu ${res.status}.`);
      payload = (await res.json()) as Payload;
      if (payload?.[appId]?.success) await this.cache.set(url, payload).catch(() => undefined);
    }
    const entry = payload?.[appId];
    return entry?.success && entry.data ? entry.data : null;
  }

  private async webApi<T>(path: string, query: Record<string, string>): Promise<T> {
    if (!this.isEnabled()) throw new ServiceUnavailableException('Integração com a Steam não configurada.');
    const url = `https://api.steampowered.com/${path}/?${new URLSearchParams({ key: this.key, format: 'json', ...query })}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(15_000) });
    } catch {
      throw new ServiceUnavailableException('A Steam não respondeu. Tente de novo em instantes.');
    }
    if (!res.ok) {
      // Nunca registrar a URL: ela contém a chave da API.
      this.logger.warn(`Steam Web API ${path} respondeu ${res.status}`);
      if (res.status === 429) throw new ServiceUnavailableException('Muitas consultas à Steam. Tente em alguns minutos.');
      throw new ServiceUnavailableException('A Steam não respondeu. Tente de novo em instantes.');
    }
    return (await res.json()) as T;
  }
}
