import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpCacheService } from '../../core/http-cache.service';
import { USER_AGENT } from '../../core/media.service';

export interface SteamAppDetails {
  type: string;
  name: string;
  short_description?: string;
  developers?: string[];
  publishers?: string[];
  release_date?: { coming_soon: boolean; date: string };
  genres?: { id: string; description: string }[];
}

/** A loja aceita ~200 consultas a cada 5 minutos por IP: mantém um intervalo mínimo entre elas. */
const MIN_INTERVAL_MS = 400;

/** "Coisas &amp; <b>tal</b>" → "Coisas & tal" (textos da loja e da Wikipedia vêm com HTML). */
export function plainText(html: string | null | undefined, max = 2000) {
  if (!html) return null;
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, max) : null;
}

/**
 * API pública da loja da Steam (sem chave): dados do jogo em português.
 * Usada para criar jogos na importação de bibliotecas e para traduzir sinopses do catálogo.
 * Respostas bem-sucedidas ficam em cache por 30 dias.
 */
@Injectable()
export class SteamStoreClient {
  private lastRequest = 0;

  constructor(private readonly cache: HttpCacheService) {}

  async appDetails(appId: string): Promise<SteamAppDetails | null> {
    if (!/^\d+$/.test(appId)) return null;
    const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=brazilian&cc=br`;
    type Payload = Record<string, { success: boolean; data?: SteamAppDetails }>;
    let payload = await this.cache.get<Payload>(url);
    if (!payload) {
      const wait = this.lastRequest + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastRequest = Date.now();

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
}
