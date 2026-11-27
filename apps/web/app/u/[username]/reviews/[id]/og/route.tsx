import { PLAY_STATUS_LABEL, type GameDetail } from '@savepoint/shared';
import { Brand, C, Cover, GradientLine, OG_CACHE, loadImage, ogImage } from '@/lib/og';
import { bannerJpeg, bannerResponse } from '@/lib/og-banner';
import { Heart, ReviewAvatar, STATUS_HEX, StarRow, Tag, excerpt, loadReview } from '@/lib/og-review';
import { publicApi } from '@/lib/public-api';

/**
 * GET /u/:usuario/reviews/:id/og — imagem da prévia do link da review.
 * Com banner do jogo: só a foto (estilo Letterboxd; estrelas e texto vão no título e na descrição).
 * Sem banner: cartão gerado com estrelas, status e trecho (sem o texto se tiver spoiler).
 * O cartão tem dado de usuário: gerado a cada pedido, nunca em cache. Sem cache também no banner,
 * porque a resposta depende de a review existir.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ username: string; id: string }> }) {
  const { username, id } = await params;
  const r = await loadReview(username, id);
  if (r) {
    const game = await publicApi<GameDetail>(`/games/${encodeURIComponent(r.game.slug)}`);
    const banner = await bannerJpeg(game?.backdropUrl);
    if (banner) return bannerResponse(banner, OG_CACHE.user);
  }
  const [cover, avatar] = await Promise.all([loadImage(r?.game.coverUrl), loadImage(r?.user.avatarUrl)]);
  const title = r?.game.title ?? 'Review não encontrada';

  return ogImage(
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.bg }}>
      <GradientLine />
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 56, padding: '0 72px' }}>
        {r && <Cover src={cover} width={240} />}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 16 }}>
          {r && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <ReviewAvatar src={avatar} hue={r.user.avatarHue} size={44} />
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
              <Tag color={STATUS_HEX[r.save.status]}>{PLAY_STATUS_LABEL[r.save.status]}</Tag>
              {r.save.number > 1 && <Tag color={C.text2}>{`Save ${r.save.number}`}</Tag>}
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
