'use client';

import { useState } from 'react';

/** Avaliação de 0,5 a 5 estrelas. Cada estrela tem duas áreas de clique (metade esquerda/direita). */
export function StarInput({
  value,
  onChange,
  size = 26,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  size?: number;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  return (
    <div
      className={`star-input ${hover ? 'preview' : ''}`}
      style={{ fontSize: size }}
      onMouseLeave={() => setHover(null)}
      role="radiogroup"
      aria-label="Nota"
    >
      {value ? (
        <button type="button" className="clear" onClick={() => onChange(null)} aria-label="Remover nota" disabled={disabled}>
          ✕
        </button>
      ) : null}
      {[1, 2, 3, 4, 5].map((i) => {
        const full = shown >= i * 2;
        const half = !full && shown === i * 2 - 1;
        return (
          <span key={i} className={`glyph ${full ? 'full' : half ? 'half' : ''}`}>
            ★
            {[i * 2 - 1, i * 2].map((v, k) => (
              <button
                key={v}
                type="button"
                className="hit"
                style={{ left: k ? '50%' : 0 }}
                aria-label={`${v / 2} estrelas`}
                role="radio"
                aria-checked={value === v}
                disabled={disabled}
                onMouseEnter={() => setHover(v)}
                onFocus={() => setHover(v)}
                onBlur={() => setHover(null)}
                onClick={() => onChange(value === v ? null : v)}
              />
            ))}
          </span>
        );
      })}
    </div>
  );
}
