import { MAX_FAVORITES, type QueueData } from '@savepoint/shared';
import { checkpointLabel, checkpointRating } from '@/lib/journey';
import { api } from '@/lib/api';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Histogram, Poster, SectionHead, ShelfBar, Stars } from '@/components/bits';
import { Icon } from '@/components/Icon';
import { FavoritesEditor } from '@/components/FavoritesEditor';
import { Review } from '@/components/Review';
import { QueueSection } from '@/components/QueueCarousel';
import { Slider } from '@/components/Slider';
import { getProfile } from '@/lib/profile';
import { getViewer } from '@/lib/session';
import { metaDescription, publicPageMeta } from '@/lib/site';

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const p = await getProfile(username);
  const c = p.counts;
  const resumo = `${c.played} ${c.played === 1 ? 'jogo jogado' : 'jogos jogados'}, ${c.completed} ${c.completed === 1 ? 'zerado' : 'zerados'} e ${c.hours.toLocaleString('pt-BR')} h de jogo`;
  return publicPageMeta({
    title: `${p.user.displayName} (@${p.user.username})`,
    description: metaDescription(
      p.user.bio ? `${p.user.bio} · ${resumo} no Savepoint.` : `Diário de jogos de ${p.user.displayName} no Savepoint: ${resumo}.`,
    ),
    path: `/u/${p.user.username}`,
    type: 'profile',
    ownImage: true,
  });
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const [profile, viewer, queue] = await Promise.all([
    getProfile(username),
    getViewer(),
    api<QueueData>(`/users/${encodeURIComponent(username)}/queue`),
  ]);
  const base = `/u/${profile.user.username}`;
  const ratingTotal = profile.histogram.reduce((a, b) => a + b, 0);
  const avg = ratingTotal ? profile.histogram.reduce((s, n, i) => s + n * (i + 1), 0) / ratingTotal : null;
  const genreMax = Math.max(1, ...profile.topGenres.map((g) => g.count));

  return (
    <div className="two-col">
      <div>
        {profile.isMe ? (
          <FavoritesEditor initial={profile.favorites} username={profile.user.username} />
        ) : (
          <section className="section">
            <SectionHead title="Top 4" />
            <div className="favorites">
              {profile.favorites.map((g) => (
                <Poster key={g.id} game={g} />
              ))}
              {Array.from({ length: MAX_FAVORITES - profile.favorites.length }, (_, i) => (
                <div key={i} className="fav-slot" />
              ))}
            </div>
          </section>
        )}

        <QueueSection data={queue} username={profile.user.username} title="Jogando e na fila" isMe={profile.isMe} />

        <section className="section">
          <SectionHead title="Atividade recente" href={`${base}/diary`} link="Diário" />
          {profile.recentLogs.length === 0 ? (
            <p className="muted">Nada registrado ainda.</p>
          ) : (
            <Slider label="Atividade recente">
              {profile.recentLogs.map((log) => (
                <Poster key={log.id} game={log.game}>
                  <Stars rating={checkpointRating(log)} />
                  <span style={{ display: 'flex', gap: 4 }} title={checkpointLabel(log)}>
                    {log.kind === 'CLOSED' && <Icon name="check" size={11} />}
                    {log.save.number > 1 && <Icon name="replay" size={11} />}
                    {log.note && <Icon name="text" size={11} />}
                  </span>
                </Poster>
              ))}
            </Slider>
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
