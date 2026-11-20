import type { Profile } from '@savepoint/shared';
import { Brand, C, Cover, GradientLine, OG_CACHE, OG_SIZE, loadImage, ogImage } from '@/lib/og';
import { publicApi } from '@/lib/public-api';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Perfil no Savepoint';

/** Dados de usuário: gerada a cada pedido e nunca guardada em cache (OG_CACHE.user). */
export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await publicApi<Profile>(`/users/${encodeURIComponent(username)}`);
  const top = profile ? (profile.favorites.length ? profile.favorites : profile.currentlyPlaying).slice(0, 4) : [];
  const covers = await Promise.all(top.map((g) => loadImage(g.coverUrl)));
  const stats = profile
    ? [
        { label: 'jogados', value: profile.counts.played },
        { label: 'zerados', value: profile.counts.completed },
        { label: 'horas', value: profile.counts.hours },
      ]
    : [];

  return ogImage(
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.bg }}>
      <GradientLine />
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 56, padding: '0 72px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 14 }}>
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, color: C.text, lineHeight: 1.05, letterSpacing: -1.5 }}>
            {profile?.user.displayName ?? 'Perfil não encontrado'}
          </div>
          {profile && <div style={{ display: 'flex', fontSize: 30, color: C.muted }}>@{profile.user.username}</div>}
          <div style={{ display: 'flex', gap: 36, marginTop: 24 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: 52, fontWeight: 800, color: C.accent }}>{s.value.toLocaleString('pt-BR')}</div>
                <div style={{ display: 'flex', fontSize: 24, color: C.text2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        {covers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', fontSize: 22, color: C.muted }}>{profile?.favorites.length ? 'Top 4' : 'Jogando agora'}</div>
            <div style={{ display: 'flex', gap: 14 }}>
              {covers.map((src, i) => (
                <Cover key={i} src={src} width={128} />
              ))}
            </div>
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
