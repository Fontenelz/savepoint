/**
 * Compartilha um link do site: menu nativo no celular (toque); no desktop, copia o link.
 * Só no navegador (usa window/navigator).
 */
export async function shareLink(path: string, title: string): Promise<'shared' | 'copied' | 'error'> {
  const url = `${window.location.origin}${path}`;
  if (navigator.share && window.matchMedia('(hover: none)').matches) {
    try {
      await navigator.share({ title: `${title} · Savepoint`, url });
    } catch {
      /* cancelado pelo usuário */
    }
    return 'shared';
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'error';
  }
}
