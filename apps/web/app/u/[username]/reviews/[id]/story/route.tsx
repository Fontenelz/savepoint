import { PLAY_STATUS_LABEL } from '@savepoint/shared';
import { ImageResponse } from 'next/og';
import { C, Cover, GradientLine, Logo, OG_CACHE, STORY_SIZE, loadImage } from '@/lib/og';
import { Heart, ReviewAvatar, STATUS_HEX, StarRow, Tag, excerpt, loadReview } from '@/lib/og-review';
import { SITE_URL } from '@/lib/site';

/**
 * GET /u/:usuario/reviews/:id/story — cartão vertical da review para postar nos Stories.
 * O conteúdo fica entre ~260 px do topo e ~260 px do fim: o app cobre essas faixas
 * (barra de progresso e nome em cima, campo de resposta embaixo).
 * Dado de usuário: nunca guardado em cache.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ username: string; id: string }> }) {
  const { username, id } = await params;
  const r = await loadReview(username, id);
  if (!r) return new Response('Review não encontrada', { status: 404, headers: { 'cache-control': OG_CACHE.user } });

  const [cover, avatar] = await Promise.all([loadImage(r.game.coverUrl), loadImage(r.user.avatarUrl)]);
  const title = r.game.title;
  const text = r.review ? (r.spoiler ? null : excerpt(r.review, 140)) : null;
  // Sem texto sobra espaço: capa maior.
  const coverWidth = text ? 400 : 500;

  return new ImageResponse(
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.bg }}>
      <GradientLine />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          gap: 30,
          padding: '220px 96px 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <ReviewAvatar src={avatar} hue={r.user.avatarHue} size={64} />
          <div style={{ display: 'flex', fontSize: 38, color: C.text2 }}>
            Review de <span style={{ color: C.text, fontWeight: 700, marginLeft: 12 }}>{r.user.displayName}</span>
          </div>
        </div>
        <div style={{ display: 'flex', borderRadius: 14, boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
          <Cover src={cover} width={coverWidth} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              textAlign: 'center',
              justifyContent: 'center',
              fontSize: title.length > 22 ? 60 : 74,
              fontWeight: 800,
              color: C.text,
              lineHeight: 1.05,
              letterSpacing: -2,
            }}
          >
            {title}
          </div>
          {r.game.releaseYear && <div style={{ display: 'flex', fontSize: 36, color: C.muted }}>{r.game.releaseYear}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {r.rating ? <StarRow rating={r.rating} size={76} /> : null}
          {r.liked && <Heart size={66} />}
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          <Tag color={STATUS_HEX[r.save.status]} size={34}>
            {PLAY_STATUS_LABEL[r.save.status]}
          </Tag>
          {r.save.number > 1 && (
            <Tag color={C.text2} size={34}>
              {`Save ${r.save.number}`}
            </Tag>
          )}
        </div>
        {text && (
          <div style={{ display: 'flex', textAlign: 'center', justifyContent: 'center', fontSize: 38, color: C.text2, lineHeight: 1.4 }}>
            {`“${text}”`}
          </div>
        )}
        {r.review && r.spoiler && <div style={{ display: 'flex', fontSize: 36, color: C.muted }}>Esta review contém spoilers.</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0 220px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Logo size={60} />
          <div style={{ display: 'flex', fontSize: 46, fontWeight: 700, color: C.text, letterSpacing: -0.5 }}>savepoint</div>
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: C.muted }}>{new URL(SITE_URL).host}</div>
      </div>
    </div>,
    {
      ...STORY_SIZE,
      headers: {
        'cache-control': OG_CACHE.user,
        'content-disposition': `inline; filename="savepoint-${r.game.slug}.png"`,
      },
    },
  );
}
