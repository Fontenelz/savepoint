'use client';

import { useState } from 'react';
import { Icon } from './Icon';

/**
 * "Imagem para Stories": no celular abre o menu nativo já com a imagem (dá para escolher
 * Instagram, WhatsApp…); onde o navegador não compartilha arquivos, baixa o PNG.
 */
export function StoryButton({ path, fileName }: { path: string; fileName: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  async function onClick() {
    setState('busy');
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: 'image/png' });

      const touch = window.matchMedia('(hover: none)').matches;
      if (touch && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
        } catch {
          /* cancelado pelo usuário */
        }
        setState('idle');
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState('done');
    } catch {
      setState('error');
    }
    setTimeout(() => setState('idle'), 2200);
  }

  const label =
    state === 'busy' ? 'Gerando imagem…' : state === 'done' ? 'Imagem baixada ✓' : state === 'error' ? 'Não foi possível gerar' : 'Imagem para Stories';

  return (
    <button type="button" className="btn btn-sm" onClick={onClick} disabled={state === 'busy'} aria-live="polite">
      <Icon name="download" size={13} /> {label}
    </button>
  );
}
