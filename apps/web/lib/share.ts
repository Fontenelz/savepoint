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

/** Baixa uma imagem gerada pelo site (ex.: /games/x/story) como arquivo PNG. */
export async function fetchImageFile(path: string, fileName: string): Promise<File> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(String(res.status));
  return new File([await res.blob()], fileName, { type: 'image/png' });
}

/**
 * Compartilha uma imagem: no celular abre o menu nativo já com o arquivo (Instagram, WhatsApp…);
 * onde o navegador não compartilha arquivos, baixa o PNG.
 */
export async function shareImageFile(file: File): Promise<'shared' | 'downloaded'> {
  const touch = window.matchMedia('(hover: none)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch {
      /* cancelado pelo usuário */
    }
    return 'shared';
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
