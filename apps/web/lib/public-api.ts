import 'server-only';

const API_URL = process.env.API_URL ?? 'http://localhost:3333/api';
const API_ORIGIN = new URL(API_URL).origin;

/**
 * Busca na API **sem** o cookie de quem está vendo. Usado em imagens de compartilhamento,
 * sitemap e dados estruturados: o resultado nunca pode depender de quem fez a requisição.
 * Devolve null em qualquer erro (404, API fora do ar): quem chama decide o que mostrar.
 */
export async function publicApi<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Capas em disco local vêm como "/media/…": as imagens geradas precisam do endereço completo. */
export function absoluteMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('/') ? `${API_ORIGIN}${url}` : url;
}
