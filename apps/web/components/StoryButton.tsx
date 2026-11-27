'use client';

import { useState } from 'react';
import { fetchImageFile, shareImageFile } from '@/lib/share';
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
      const res = await shareImageFile(await fetchImageFile(path, fileName));
      if (res === 'shared') return setState('idle');
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
