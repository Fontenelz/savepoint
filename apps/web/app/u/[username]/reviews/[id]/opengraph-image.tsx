import { PLAY_STATUS_LABEL } from '@savepoint/shared';
import { Brand, C, Cover, GradientLine, OG_CACHE, OG_SIZE, loadImage, ogImage } from '@/lib/og';
import { Heart, ReviewAvatar, STATUS_HEX, StarRow, Tag, excerpt, loadReview } from '@/lib/og-review';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Review no Savepoint';

/**
 * Review é conteúdo de usuário: gerada a cada pedido e nunca guardada em cache (OG_CACHE.user).
 * Review com spoiler não mostra o texto, igual à página.
 */
export default async function Image({ params }: { params: Promise<{ username: string; id: string }> }) {
  const { username, id } = await params;
  const r = await loadReview(username, id);
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
