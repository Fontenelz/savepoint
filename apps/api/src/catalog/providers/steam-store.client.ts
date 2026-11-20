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

const PT_WORDS = /\b(de|um|uma|que|para|com|seu|sua|não|você|em|os|as|dos|das|é)\b/gi;
const EN_WORDS = /\b(the|and|of|to|your|with|you|is|in|for|an|its)\b/gi;

/**
 * A loja devolve o texto em inglês quando o jogo não tem tradução, mesmo pedindo português.
 * Compara palavras comuns de cada idioma (suficiente para sinopses curtas).
 */
export function looksPortuguese(text: string) {
  const pt = text.match(PT_WORDS)?.length ?? 0;
  const en = text.match(EN_WORDS)?.length ?? 0;
  return pt > en;
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
    const payload = await this.getJson<Payload>(url, (p) => Boolean(p?.[appId]?.success));
    const entry = payload?.[appId];
    return entry?.success && entry.data ? entry.data : null;
  }

  /**
   * Resumo das avaliações da loja: % positivas e total.
   * Soma o histograma mensal/semanal (`appreviewhistogram`): o `appreviews?json=1` redireciona
   * para a home em algumas redes, este não. Confere com a loja (RDR2 91%, Hades 98%).
   */
  async reviewSummary(appId: string): Promise<{ score: number; total: number } | null> {
    if (!/^\d+$/.test(appId)) return null;
    const url = `https://store.steampowered.com/appreviewhistogram/${appId}?l=english&review_score_preference=0`;
    type Rollup = { recommendations_up: number; recommendations_down: number };
    type Payload = { success: number; results?: { rollups?: Rollup[] } };
    const payload = await this.getJson<Payload>(url, (p) => p?.success === 1);
    let up = 0;
    let down = 0;
    for (const r of payload?.results?.rollups ?? []) {
      up += r.recommendations_up ?? 0;
      down += r.recommendations_down ?? 0;
    }
    const total = up + down;
    return total ? { score: Math.round((up / total) * 100), total } : null;
  }

  /** GET com intervalo mínimo entre chamadas; guarda no cache só o que `cacheable` aprovar. */
  private async getJson<T>(url: string, cacheable: (payload: T) => boolean): Promise<T> {
    const cached = await this.cache.get<T>(url);
    if (cached) return cached;

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
    const payload = (await res.json()) as T;
    if (cacheable(payload)) await this.cache.set(url, payload).catch(() => undefined);
    return payload;
  }
}
