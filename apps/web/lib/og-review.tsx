import 'server-only';
import type { PlayStatus, ReviewView } from '@savepoint/shared';
import { C } from './og';
import { publicApi } from './public-api';

/** Peças comuns da prévia de link (1200×630) e do cartão de Stories (1080×1920) de uma review. */

/**
 * Review sem o cookie de quem pede, e só se for de quem está na URL:
 * /u/outra-pessoa/reviews/<id> não gera imagem da review de alguém.
 */
export async function loadReview(username: string, id: string) {
  const r = await publicApi<ReviewView>(`/saves/${encodeURIComponent(id)}`);
  return r?.user.username === username ? r : null;
}

/** Mesmas cores de --st-* do globals.css (a imagem não lê CSS). */
export const STATUS_HEX: Record<PlayStatus, string> = {
  BACKLOG: '#8f96ff',
  PLAYING: '#5cc8ff',
  PAUSED: '#ffae57',
  COMPLETED: '#c6ff3d',
  MASTERED: '#ffd84a',
  DROPPED: '#ff6b6b',
  ENDLESS: '#c38bff',
};

const STAR = 'M12 1.8l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.6l-6.3 3.6 1.5-7.1L1.8 9.2 9 8.4z';

/** Estrelas desenhadas em SVG: a fonte padrão do gerador não tem o caractere ★. */
export function StarRow({ rating, size = 46 }: { rating: number; size?: number }) {
  const full = Math.floor(rating / 2);
  const half = rating % 2 === 1;
  const gap = Math.round(size / 8);
  return (
    <div style={{ display: 'flex', gap }}>
      {Array.from({ length: full }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24">
          <path d={STAR} fill={C.accent} />
        </svg>
      ))}
      {half && (
        <div style={{ display: 'flex', position: 'relative', width: size, height: size }}>
          <svg width={size} height={size} viewBox="0 0 24 24">
            <path d={STAR} fill={C.line} />
          </svg>
          <div style={{ display: 'flex', position: 'absolute', left: 0, top: 0, width: size / 2, height: size, overflow: 'hidden' }}>
            <svg width={size} height={size} viewBox="0 0 24 24">
              <path d={STAR} fill={C.accent} />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

export function Heart({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path
        fill="#ff5a7a"
        d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 3 4.5 6.9 4.5c2.2 0 3.6 1.2 5.1 3 1.5-1.8 2.9-3 5.1-3 3.9 0 6 4.1 4.5 7.4C19.5 16.4 12 21 12 21z"
      />
    </svg>
  );
}

/** Foto da conta quando houver (já em data URL); senão, o degradê da cor do usuário. */
export function ReviewAvatar({ src, hue, size }: { src: string | null; hue: number; size: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={size} height={size} style={{ borderRadius: size / 2, objectFit: 'cover' }} alt="" />
  ) : (
    <div
      style={{
        display: 'flex',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundImage: `linear-gradient(140deg, hsl(${hue} 85% 70%), hsl(${hue + 40} 75% 52%))`,
      }}
    />
  );
}

/** Etiqueta de status / "Save N". */
export function Tag({ children, color, size = 24 }: { children: string; color: string; size?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        fontSize: size,
        color,
        border: `2px solid ${color === C.text2 ? C.line : color}`,
        borderRadius: Math.round(size / 3),
        padding: `${Math.round(size / 6)}px ${Math.round(size / 1.7)}px`,
      }}
    >
      {children}
    </div>
  );
}

/** Corta no limite de palavra. */
export function excerpt(text: string, max: number) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : clean;
}
