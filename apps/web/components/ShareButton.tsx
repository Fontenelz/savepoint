'use client';

import { useEffect, useState } from 'react';
import { shareLink } from '@/lib/share';
import { Icon } from './Icon';

/** Botão "Compartilhar" (review, lista): menu nativo no celular, cópia do link no desktop. */
export function ShareButton({ path, title, className = 'btn btn-sm' }: { path: string; title: string; className?: string }) {
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 2200);
    return () => clearTimeout(t);
  }, [feedback]);

  async function onClick() {
    const res = await shareLink(path, title);
    if (res === 'copied') setFeedback('Link copiado ✓');
    else if (res === 'error') setFeedback('Não foi possível copiar');
  }

  return (
    <button type="button" className={className} onClick={onClick} aria-live="polite">
      <Icon name="share" size={13} /> {feedback ?? 'Compartilhar'}
    </button>
  );
}
