import { PLAY_STATUS_LABEL, type PlayStatus, type ReviewView } from '@savepoint/shared';
import { Brand, C, Cover, GradientLine, OG_CACHE, OG_SIZE, loadImage, ogImage } from '@/lib/og';
import { publicApi } from '@/lib/public-api';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Review no Savepoint';

/** Mesmas cores de --st-* do globals.css (a imagem não lê CSS). */
const STATUS_HEX: Record<PlayStatus, string> = {
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
function StarRow({ rating, size = 46 }: { rating: number; size?: number }) {
  const full = Math.floor(rating / 2);
  const half = rating % 2 === 1;
  return (
    <div style={{ display: 'flex', gap: 6 }}>
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

function Heart({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#ff5a7a" d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 3 4.5 6.9 4.5c2.2 0 3.6 1.2 5.1 3 1.5-1.8 2.9-3 5.1-3 3.9 0 6 4.1 4.5 7.4C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

/** Corta no limite de palavra, para o texto caber em ~3 linhas. */
function excerpt(text: string, max: number) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : clean;
}

/**
 * Review é conteúdo de usuário: gerada a cada pedido e nunca guardada em cache (OG_CACHE.user).
 * Review com spoiler não mostra o texto, igual à página.
 */
export default async function Image({ params }: { params: Promise<{ username: string; id: string }> }) {
  const { username, id } = await params;
  const found = await publicApi<ReviewView>(`/saves/${encodeURIComponent(id)}`);
  // O link precisa ser do dono da review: /u/outra-pessoa/reviews/<id> não gera a prévia dela.
  const r = found?.user.username === username ? found : null;
  const [cover, avatar] = await Promise.all([loadImage(r?.game.coverUrl), loadImage(r?.user.avatarUrl)]);
  const title = r?.game.title ?? 'Review não encontrada';
  const status = r?.save.status;

  return ogImage(
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.bg }}>
      <GradientLine />
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 56, padding: '0 72px' }}>
        {r && <Cover src={cover} width={240} />}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 16 }}>
          {r && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} width={44} height={44} style={{ borderRadius: 22, objectFit: 'cover' }} alt="" />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundImage: `linear-gradient(140deg, hsl(${r.user.avatarHue} 85% 70%), hsl(${r.user.avatarHue + 40} 75% 52%))`,
                  }}
                />
              )}
              <div style={{ display: 'flex', fontSize: 28, color: C.text2 }}>
                Review de <span style={{ color: C.text, fontWeight: 700, marginLeft: 8 }}>{r.user.displayName}</span>
              </div>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              fontSize: title.length > 28 ? 54 : 66,
              fontWeight: 800,
              color: C.text,
              lineHeight: 1.05,
              letterSpacing: -1.5,
            }}
          >
            {title}
            {r?.game.releaseYear && (
              <span style={{ fontSize: 34, fontWeight: 400, color: C.muted, marginLeft: 16, alignSelf: 'flex-end', marginBottom: 6 }}>
                {r.game.releaseYear}
              </span>
            )}
          </div>
          {r && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 4 }}>
              {r.rating ? <StarRow rating={r.rating} /> : null}
              {r.liked && <Heart />}
              {status && (
                <div
                  style={{
                    display: 'flex',
                    fontSize: 24,
                    color: STATUS_HEX[status],
                    border: `2px solid ${STATUS_HEX[status]}`,
                    borderRadius: 8,
                    padding: '4px 14px',
                  }}
                >
                  {PLAY_STATUS_LABEL[status]}
                </div>
              )}
              {r.save.number > 1 && (
                <div style={{ display: 'flex', fontSize: 24, color: C.text2, border: `2px solid ${C.line}`, borderRadius: 8, padding: '4px 14px' }}>
                  Save {r.save.number}
                </div>
              )}
            </div>
          )}
          {r?.review && (
            <div style={{ display: 'flex', fontSize: 28, color: r.spoiler ? C.muted : C.text2, lineHeight: 1.4, marginTop: 6 }}>
              {r.spoiler ? 'Esta review contém spoilers.' : `“${excerpt(r.review, 150)}”`}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', padding: '0 72px 40px' }}>
        <Brand />
      </div>
    </div>,
    OG_CACHE.user,
  );
}
