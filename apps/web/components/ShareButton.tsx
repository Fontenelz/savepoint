'use client';

import { useEffect, useState } from 'react';
import { shareLink } from '@/lib/share';
import { Icon } from './Icon';

/**
 * Botão "Compartilhar" (review, lista): menu nativo no celular, cópia do link no desktop.
 * `compact`: só o ícone, no rodapé do card de review (mesmo estilo da curtida).
 */
export function ShareButton({ path, title, compact = false }: { path: string; title: string; compact?: boolean }) {
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 2200);
    return () => clearTimeout(t);
  }, [feedback]);

  async function onClick() {
    const res = await shareLink(path, title);
    if (res === 'copied') setFeedback(compact ? 'Copiado ✓' : 'Link copiado ✓');
    else if (res === 'error') setFeedback('Não foi possível copiar');
  }

  if (compact) {
    return (
      // Sem texto no retorno: o ícone vira ✓ e a largura não muda (o rodapé do card é apertado no celular).
      <button
        type="button"
        className="like-btn share-compact"
        onClick={onClick}
        title={feedback ?? 'Compartilhar'}
        aria-label={feedback ?? 'Compartilhar review'}
      >
        <Icon name={feedback === 'Copiado ✓' ? 'check' : 'share'} size={13} />
      </button>
    );
  }

  return (
    <button type="button" className="btn btn-sm" onClick={onClick} aria-live="polite">
      <Icon name="share" size={13} /> {feedback ?? 'Compartilhar'}
    </button>
  );
}
