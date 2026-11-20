import { PLAY_STATUS_LABEL, formatHours, type CatalogSource, type GameDetail, type ListSummary } from '@savepoint/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Avatar, Histogram, ListCard, SectionHead, ShelfBar, Stars } from '@/components/bits';
import { GameActions } from '@/components/GameActions';
import { GameCover } from '@/components/GameCover';
import { Icon, STATUS_COLOR } from '@/components/Icon';
import { Review } from '@/components/Review';
import { api, apiOrNotFound } from '@/lib/api';
import { getViewer } from '@/lib/session';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const g = await api<GameDetail>(`/games/${slug}`);
    return { title: `${g.title}${g.releaseYear ? ` (${g.releaseYear})` : ''}`, description: g.summary ?? undefined };
  } catch {
    return { title: 'Jogo' };
  }
}

const SOURCE_LABEL: Record<CatalogSource, string> = {
  LOCAL: 'catálogo curado',
  COMMUNITY: 'cadastrado pela comunidade',
  IGDB: 'importado do IGDB',
  STEAM: 'importado da Steam',
  RAWG: 'importado da RAWG',
};

export default async function GamePage({ params }: Props) {
  const { slug } = await params;
  const [viewer, game] = await Promise.all([getViewer(), apiOrNotFound<GameDetail>(`/games/${slug}`)]);
  const myLists = viewer ? await api<ListSummary[]>(`/users/${viewer.username}/lists`) : [];
  const { stats } = game;

  return (
    <>
      <div className={`backdrop ${game.backdropUrl ? 'has-art' : ''}`} aria-hidden>
        {game.backdropUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="backdrop-img" src={game.backdropUrl} alt="" />
        ) : (
          <div className="backdrop-art">
            <GameCover game={game} />
          </div>
        )}
        <div className="backdrop-pattern" />
      </div>

      <div className="shell game-layout">
        <aside className="game-cover">
          <GameCover game={game} />
          <div className="game-counters">
            <span className="c-play" title="Jogadores">
              <Icon name="gamepad" size={14} /> <span className="mono">{stats.playerCount}</span>
            </span>
            <span className="c-list" title="Em listas">
              <Icon name="list" size={14} /> <span className="mono">{stats.listCount}</span>
            </span>
            <span className="c-like" title="Curtidas">
              <Icon name="heart" size={14} fill /> <span className="mono">{stats.likeCount}</span>
            </span>
          </div>
        </aside>

        <section className="game-main">
          <h1 className="game-title">{game.title}</h1>
          <div className="game-sub">
            {game.releaseYear && (
              <Link href={`/games?year=${game.releaseYear}`} className="mono">
                {game.releaseYear}
              </Link>
            )}
            {game.developer && (
              <span>
                por <strong style={{ color: 'var(--text)' }}>{game.developer}</strong>
              </span>
            )}
          </div>

          {game.summary && <p className="game-summary">{game.summary}</p>}

          <dl className="facts">
            {game.genres.length > 0 && (
              <>
                <dt>Gêneros</dt>
                <dd className="chips">
                  {game.genres.map((g) => (
                    <Link key={g.id} className="chip" href={`/games?genre=${g.slug}`}>
                      {g.name}
                    </Link>
                  ))}
                </dd>
              </>
            )}
            {game.platformList.length > 0 && (
              <>
                <dt>Plataformas</dt>
                <dd className="chips">
                  {game.platformList.map((p) => (
                    <Link key={p.id} className="chip" href={`/games?platform=${p.slug}`}>
                      {p.short}
                    </Link>
                  ))}
                </dd>
              </>
            )}
            {(game.avgHours || stats.communityHours) && (
              <>
                <dt>Para zerar</dt>
                <dd>
                  {game.avgHours ? <span className="mono">~{formatHours(game.avgHours)}</span> : null}
                  {stats.communityHours ? (
                    <span className="muted">
                      {game.avgHours ? ' · ' : ''}comunidade: <span className="mono">{formatHours(stats.communityHours)}</span>
                    </span>
                  ) : null}
                </dd>
              </>
            )}
            {game.publisher && game.publisher !== game.developer && (
              <>
                <dt>Publicadora</dt>
                <dd>{game.publisher}</dd>
              </>
            )}
          </dl>

          {game.friends.length > 0 && (
            <section className="section">
              <SectionHead title="Quem você segue" />
              <div className="friends-strip">
                {game.friends.map((f) => (
                  <Link key={f.user.id} href={`/u/${f.user.username}`} className="friend" title={f.user.displayName}>
                    <Avatar user={f.user} size={40} />
                    {f.rating ? (
                      <Stars rating={f.rating} className="mono" />
                    ) : f.status ? (
                      <span style={{ color: STATUS_COLOR[f.status] }}>{PLAY_STATUS_LABEL[f.status]}</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="section">
            <SectionHead title="Reviews populares" />
            {game.popularReviews.length === 0 && game.recentReviews.length === 0 ? (
              <p className="muted">Ninguém escreveu sobre {game.title} ainda. Que tal ser o primeiro?</p>
            ) : (
              game.popularReviews.map((log) => <Review key={log.id} log={log} showGame={false} canLike={Boolean(viewer)} />)
            )}
          </section>

          {game.recentReviews.length > 0 && (
            <section className="section">
              <SectionHead title="Reviews recentes" />
              {game.recentReviews.map((log) => (
                <Review key={log.id} log={log} showGame={false} canLike={Boolean(viewer)} />
              ))}
            </section>
          )}

          {game.lists.length > 0 && (
            <section className="section">
              <SectionHead title="Aparece nas listas" />
              <div className="grid-lists">
                {game.lists.map((l) => (
                  <ListCard key={l.id} list={l} />
                ))}
              </div>
            </section>
          )}

          <p className="source-note">
            Fonte: {SOURCE_LABEL[game.source]}
            {game.createdBy && (
              <>
                {' '}por <Link href={`/u/${game.createdBy.username}`}>{game.createdBy.displayName}</Link>
              </>
            )}
            .
          </p>
        </section>

        <aside className="game-side">
          <GameActions
            game={game}
            platforms={game.platformList}
            initial={game.viewer}
            loggedIn={Boolean(viewer)}
            myLists={myLists.map((l) => ({ id: l.id, title: l.title }))}
          />

          <div className="panel">
            <h3>
              Avaliações <span className="mono">{stats.logCount} registros</span>
            </h3>
            <Histogram histogram={stats.histogram} avg={stats.ratingAvg} count={stats.ratingCount} />
          </div>

          <div className="panel">
            <h3>Estante da comunidade</h3>
            <ShelfBar counts={stats.statusCounts} />
          </div>
        </aside>
      </div>
    </>
  );
}
