import type { ListDetail } from '@savepoint/shared';
import { Brand, C, Cover, GradientLine, OG_CACHE, OG_SIZE, loadImage, ogImage } from '@/lib/og';
import { publicApi } from '@/lib/public-api';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Lista no Savepoint';

/** Lista é conteúdo de usuário: gerada a cada pedido e nunca guardada em cache (OG_CACHE.user). */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const list = await publicApi<ListDetail>(`/lists/${encodeURIComponent(id)}`);
  const games = (list?.items ?? []).slice(0, 5).map((i) => i.game);
  const covers = await Promise.all(games.map((g) => loadImage(g.coverUrl)));
  const title = list?.title ?? 'Lista não encontrada';

  return ogImage(
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.bg }}>
      <GradientLine />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 16, padding: '0 72px' }}>
        <div style={{ display: 'flex', fontSize: 24, color: C.accent, fontWeight: 700, letterSpacing: 2 }}>
          {list?.ranked ? 'LISTA RANQUEADA' : 'LISTA'}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: title.length > 36 ? 52 : 64,
            fontWeight: 800,
            color: C.text,
            lineHeight: 1.05,
            letterSpacing: -1.5,
          }}
        >
          {title}
        </div>
        {list && (
          <div style={{ display: 'flex', fontSize: 28, color: C.text2 }}>
            {`por @${list.user.username} · ${list.itemCount} ${list.itemCount === 1 ? 'jogo' : 'jogos'}`}
          </div>
        )}
        {covers.length > 0 && (
          <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
            {covers.map((src, i) => (
              <Cover key={i} src={src} width={120} />
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', padding: '0 72px 40px' }}>
        <Brand />
      </div>
    </div>,
    OG_CACHE.user,
  );
}
