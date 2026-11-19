import { MAX_FAVORITES } from '@savepoint/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Histogram, Poster, SectionHead, ShelfBar, Stars } from '@/components/bits';
import { Icon } from '@/components/Icon';
import { Review } from '@/components/Review';
import { getProfile } from '@/lib/profile';
import { getViewer } from '@/lib/session';

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const p = await getProfile(username);
  return { title: `${p.user.displayName} (@${p.user.username})` };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const [profile, viewer] = await Promise.all([getProfile(username), getViewer()]);
  const base = `/u/${profile.user.username}`;
  const ratingTotal = profile.histogram.reduce((a, b) => a + b, 0);
  const avg = ratingTotal ? profile.histogram.reduce((s, n, i) => s + n * (i + 1), 0) / ratingTotal : null;
  const genreMax = Math.max(1, ...profile.topGenres.map((g) => g.count));

  return (
    <div className="two-col">
      <div>
        <section className="section">
          <SectionHead title="Top 4" />
          <div className="favorites">
            {profile.favorites.map((g) => (
              <Poster key={g.id} game={g} />
            ))}
            {Array.from({ length: MAX_FAVORITES - profile.favorites.length }, (_, i) => (
              <div key={i} className="fav-slot">
                {profile.isMe ? 'Marque ★ Top 4 na página de um jogo' : ''}
              </div>
            ))}
          </div>
        </section>

        {profile.currentlyPlaying.length > 0 && (
          <section className="section">
            <SectionHead title="Jogando agora" href={`${base}/games?filter=PLAYING`} />
            <div className="row-posters">
              {profile.currentlyPlaying.map((g) => (
                <Poster key={g.id} game={g} status="PLAYING" />
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <SectionHead title="Atividade recente" href={`${base}/diary`} link="Diário" />
          {profile.recentLogs.length === 0 ? (
            <p className="muted">Nada registrado ainda.</p>
          ) : (
            <div className="row-posters">
              {profile.recentLogs.slice(0, 6).map((log) => (
                <Poster key={log.id} game={log.game}>
                  <Stars rating={log.rating} />
                  <span style={{ display: 'flex', gap: 4 }}>
                    {log.liked && <Icon name="heart" size={11} fill className="heart" />}
                    {log.replay && <Icon name="replay" size={11} />}
                    {log.review && <Icon name="text" size={11} />}
                  </span>
                </Poster>
              ))}
            </div>
          )}
        </section>

        {profile.recentReviews.length > 0 && (
          <section className="section">
            <SectionHead title="Reviews recentes" href={`${base}/reviews`} />
            {profile.recentReviews.map((log) => (
              <Review key={log.id} log={log} canLike={Boolean(viewer)} />
            ))}
          </section>
        )}
      </div>

      <aside style={{ display: 'grid', gap: 18, alignContent: 'start' }} className="section">
        <div className="panel">
          <h3>
            Estante <span className="mono">{profile.counts.completed} zerados</span>
          </h3>
          <ShelfBar counts={profile.statusCounts} hrefFor={(s) => `${base}/games?filter=${s}`} />
        </div>
        <div className="panel">
          <h3>Notas</h3>
          <Histogram histogram={profile.histogram} avg={avg} count={ratingTotal} />
        </div>
        {profile.topGenres.length > 0 && (
          <div className="panel">
            <h3>Gêneros favoritos</h3>
            <div className="genre-bars">
              {profile.topGenres.map((g) => (
                <div key={g.name}>
                  <span>{g.name}</span>
                  <i style={{ width: `${(g.count / genreMax) * 100}%` }} />
                  <b>{g.count}</b>
                </div>
              ))}
            </div>
          </div>
        )}
        {profile.topPlatforms.length > 0 && (
          <div className="panel">
            <h3>Onde joga</h3>
            <div className="chips">
              {profile.topPlatforms.map((p) => (
                <span key={p.name} className="chip">
                  {p.name} · <span className="mono">{p.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        <Link href={`${base}/games?filter=BACKLOG`} className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            <span className="label">Backlog</span>
            <br />
            <span className="mono" style={{ fontSize: 22 }}>
              {profile.counts.backlog}
            </span>{' '}
            <span className="muted">na fila</span>
          </span>
          <Icon name="bookmark" size={22} />
        </Link>
      </aside>
    </div>
  );
}
