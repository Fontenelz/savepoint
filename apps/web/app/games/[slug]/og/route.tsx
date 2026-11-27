import type { GameDetail } from '@savepoint/shared';
import { Brand, C, Cover, GradientLine, OG_CACHE, loadImage, ogImage } from '@/lib/og';
import { bannerJpeg, bannerResponse } from '@/lib/og-banner';
import { publicApi } from '@/lib/public-api';

/**
 * GET /games/:slug/og — imagem da prévia do link (WhatsApp, X, Discord…).
 * Com banner: a foto do banner ocupando o cartão (estilo Letterboxd). Sem banner: cartão gerado.
 * Só dados de catálogo: pode ter cache.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await publicApi<GameDetail>(`/games/${encodeURIComponent(slug)}`);
  const banner = await bannerJpeg(game?.backdropUrl);
  if (banner) return bannerResponse(banner, OG_CACHE.catalog);

  // Capa de 240 px: PNG de foto pesa muito (WhatsApp descarta prévias pesadas).
  const cover = await loadImage(game?.coverUrl);
  const meta = [game?.releaseYear, game?.developer].filter(Boolean).join(' · ');
  const genres = (game?.genres ?? []).slice(0, 3).map((g) => g.name);
  const title = game?.title ?? 'Jogo não encontrado';

  return ogImage(
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.bg, position: 'relative' }}>
      <GradientLine />
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 56, padding: '0 72px' }}>
        <Cover src={cover} width={240} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 18 }}>
          <div
            style={{
              display: 'flex',
              fontSize: title.length > 28 ? 58 : 72,
              fontWeight: 800,
              color: C.text,
              lineHeight: 1.05,
              letterSpacing: -1.5,
            }}
          >
            {title}
          </div>
          {meta && <div style={{ display: 'flex', fontSize: 30, color: C.text2 }}>{meta}</div>}
          {genres.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
              {genres.map((g) => (
                <div
                  key={g}
                  style={{ display: 'flex', fontSize: 24, color: C.accent, border: `2px solid ${C.accent}`, borderRadius: 8, padding: '4px 14px' }}
                >
                  {g}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 72px 40px' }}>
        <Brand />
        <div style={{ display: 'flex', fontSize: 24, color: C.muted }}>Registre, avalie e acompanhe no seu diário</div>
      </div>
    </div>,
    game ? OG_CACHE.catalog : OG_CACHE.user,
  );
}
