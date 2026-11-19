'use client';

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Carrossel horizontal de capas: arrastar/deslizar no celular, setas no desktop.
 * Usa scroll nativo com scroll-snap (acessível, funciona com teclado e trackpad).
 */
export function Slider({ label, children }: { label: string; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [update]);

  const go = (dir: -1 | 1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  };

  const scrollable = !(edges.start && edges.end);

  return (
    <div className="slider" role="region" aria-roledescription="carrossel" aria-label={label}>
      {scrollable && (
        <button type="button" className="slider-btn prev" onClick={() => go(-1)} disabled={edges.start} aria-label="Anteriores">
          <Icon name="up" size={16} className="rot-left" />
        </button>
      )}
      <div className="slider-track" ref={track}>
        {Children.map(children, (child) => (
          <div className="slider-item">{child}</div>
        ))}
      </div>
      {scrollable && (
        <button type="button" className="slider-btn next" onClick={() => go(1)} disabled={edges.end} aria-label="Próximos">
          <Icon name="up" size={16} className="rot-right" />
        </button>
      )}
    </div>
  );
}
