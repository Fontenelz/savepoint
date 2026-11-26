import { PLAY_STATUS_LABEL, canRate, formatAvg, formatHours, type CatalogSource, type GameDetail, type ListSummary } from '@savepoint/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Avatar, Histogram, ListCard, Poster, SectionHead, ShelfBar, Stars } from '@/components/bits';
import { GameActions, OpenLogButton } from '@/components/GameActions';
import { GameCover } from '@/components/GameCover';
import { Icon, STATUS_COLOR } from '@/components/Icon';
import { Review } from '@/components/Review';
import { Slider } from '@/components/Slider';
import { api, apiOrNotFound } from '@/lib/api';
import { plural } from '@/lib/format';
import { getViewer } from '@/lib/session';
import { SITE_URL, metaDescription, publicPageMeta } from '@/lib/site';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    // Mesma requisição da página (o Next reaproveita a resposta); só campos públicos são usados.
    const g = await api<GameDetail>(`/games/${slug}`);
    return publicPageMeta({
      title: `${g.title}${g.releaseYear ? ` (${g.releaseYear})` : ''}`,
      description: metaDescription(g.summary, `${g.title} no Savepoint: notas da comunidade, reviews e quem está jogando.`),
      path: `/games/${g.slug}`,
      ownImage: true,
    });
  } catch {
    return { title: 'Jogo' };
  }
}

/**
 * Dados estruturados (schema.org/VideoGame) para o Google. Nota de 1–10 vira escala de 5 estrelas,
 * como no site. `<` é escapado: a sinopse pode ter sido escrita por um usuário.
 */
function gameJsonLd(game: GameDetail) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: game.title,
    url: `${SITE_URL}/games/${game.slug}`,
    ...(game.summary ? { description: metaDescription(game.summary, '') } : {}),
    ...(game.coverUrl ? { image: game.coverUrl.startsWith('/') ? `${SITE_URL}${game.coverUrl}` : game.coverUrl } : {}),
    ...(game.releaseYear ? { datePublished: String(game.releaseYear) } : {}),
    ...(game.developer ? { author: { '@type': 'Organization', name: game.developer } } : {}),
    ...(game.publisher ? { publisher: { '@type': 'Organization', name: game.publisher } } : {}),
    ...(game.genres.length ? { genre: game.genres.map((g) => g.name) } : {}),
    ...(game.platformList.length ? { gamePlatform: game.platformList.map((p) => p.name) } : {}),
    ...(game.stats.ratingAvg != null && game.stats.ratingCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Math.round((game.stats.ratingAvg / 2) * 10) / 10,
            bestRating: 5,
            worstRating: 0.5,
            ratingCount: game.stats.ratingCount,
          },
        }
      : {}),
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
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
  // "Jogaram" = na estante, menos quem só quer jogar (inclui quem veio da Steam só com horas).
  const played = Math.max(0, stats.playerCount - stats.statusCounts.BACKLOG);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: gameJsonLd(game) }} />
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
          <div className="game-cover-art">
            <GameCover game={game} />
          </div>

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
            {game.steamAppId && (
              <>
                <dt>Loja</dt>
                <dd>
                  <a
                    className="ext-link"
                    href={`https://store.steampowered.com/app/${game.steamAppId}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver na Steam <Icon name="external" size={12} />
                  </a>
                </dd>
              </>
            )}
          </dl>
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

          <div className="game-hud">
            <div className="game-hud-rating" title={`${stats.ratingCount} ${stats.ratingCount === 1 ? 'nota' : 'notas'}`}>
              <b>
                <Icon name="star" size={15} fill /> {formatAvg(stats.ratingAvg)}
              </b>
              <span>Nota média</span>
            </div>
            <div>
              <b>{played}</b>
              <span>Jogaram</span>
            </div>
            <div>
              <b>{stats.statusCounts.PLAYING}</b>
              <span>Jogando</span>
            </div>
            <div>
              <b>{stats.statusCounts.BACKLOG}</b>
              <span>Querem jogar</span>
            </div>
            <div>
              <b>{stats.logCount}</b>
              <span>Checkpoints</span>
            </div>
          </div>

          {game.summary && <p className="game-summary">{game.summary}</p>}

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

          <section className="section" id="reviews">
            <SectionHead title="Reviews populares" />
            {game.popularReviews.length === 0 && game.recentReviews.length === 0 ? (
              <div className="empty empty-reviews">
                <Icon name="chat" size={22} />
                <strong>Nenhuma review ainda</strong>
                <p>
                  {viewer && canRate(game.viewerSave?.status)
                    ? `Conte o que achou de ${game.title} e seja a primeira voz por aqui.`
                    : 'As reviews chegam quando alguém zera ou abandona o jogo. Até lá, registre sua jornada.'}
                </p>
                {viewer ? (
                  <OpenLogButton>{canRate(game.viewerSave?.status) ? 'Escrever a primeira review' : 'Novo checkpoint'}</OpenLogButton>
                ) : (
                  <Link href={`/login?next=/games/${game.slug}`} className="btn btn-sm">
                    Entrar para escrever
                  </Link>
                )}
              </div>
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

          {game.similar.length > 0 && (
            <section className="section">
              <SectionHead title="Jogos parecidos" />
              <Slider label="Jogos parecidos">
                {game.similar.map((g) => (
                  <Poster key={g.id} game={g} />
                ))}
              </Slider>
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
            initialSave={game.viewerSave}
            endlessHint={game.endlessHint}
            loggedIn={Boolean(viewer)}
            myLists={myLists.map((l) => ({ id: l.id, title: l.title }))}
          />

          <div className="panel">
            <h3>
              Avaliações <span className="mono">{plural(stats.ratingCount, 'nota', 'notas')}</span>
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
