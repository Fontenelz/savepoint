import type { GameDetail } from '@savepoint/shared';
import { ImageResponse } from 'next/og';
import { C, Cover, Logo, OG_CACHE, STORY_SIZE, loadImage } from '@/lib/og';
import { publicApi } from '@/lib/public-api';

/**
 * GET /games/:slug/story — cartão vertical do jogo para os Stories (estilo Letterboxd):
 * capa grande, título, "por <desenvolvedora>" e "no savepoint". Só dados de catálogo: pode ter cache.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await publicApi<GameDetail>(`/games/${encodeURIComponent(slug)}`);
  if (!game) return new Response('Jogo não encontrado', { status: 404, headers: { 'cache-control': OG_CACHE.user } });

  const cover = await loadImage(game.coverUrl);
  const title = game.title;

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '260px 96px',
        backgroundImage: `linear-gradient(180deg, #3a4354 0%, #1d222c 45%, ${C.bg} 100%)`,
      }}
    >
      <div style={{ display: 'flex', borderRadius: 14, boxShadow: '0 40px 90px rgba(0,0,0,0.65)' }}>
        <Cover src={cover} width={600} />
      </div>
      <div
        style={{
          display: 'flex',
          textAlign: 'center',
          justifyContent: 'center',
          marginTop: 64,
          fontSize: title.length > 24 ? 62 : 74,
          fontWeight: 800,
          color: C.text,
          lineHeight: 1.05,
          letterSpacing: -2,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', marginTop: 28, fontSize: 38, color: C.muted }}>
        {game.developer ? (
          <>
            por <span style={{ color: C.text2, fontWeight: 700, marginLeft: 12 }}>{game.developer}</span>
          </>
        ) : (
          (game.releaseYear ?? '')
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 64 }}>
        <div style={{ display: 'flex', width: 150, height: 2, background: C.muted, opacity: 0.6 }} />
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: C.muted, letterSpacing: 3 }}>NO</div>
        <div style={{ display: 'flex', width: 150, height: 2, background: C.muted, opacity: 0.6 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 18 }}>
        <Logo size={64} />
        <div style={{ display: 'flex', fontSize: 54, fontWeight: 700, color: C.text, letterSpacing: -0.5 }}>savepoint</div>
      </div>
    </div>,
    {
      ...STORY_SIZE,
      headers: {
        'cache-control': OG_CACHE.catalog,
        'content-disposition': `inline; filename="savepoint-${game.slug}.png"`,
      },
    },
  );
}
