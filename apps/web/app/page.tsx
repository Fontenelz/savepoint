import type { HomeData, QueueData } from '@savepoint/shared';
import { checkpointRating, checkpointVerb } from '@/lib/journey';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Avatar, CoverWall, ListCard, Poster, SectionHead, Stars } from '@/components/bits';
import { Icon } from '@/components/Icon';
import { QueueSection } from '@/components/QueueCarousel';
import { TopRanking } from '@/components/TopRanking';
import { Review } from '@/components/Review';
import { api } from '@/lib/api';
import { getViewer } from '@/lib/session';
import { SITE_DESCRIPTION, publicPageMeta } from '@/lib/site';

const homeMeta = publicPageMeta({ title: 'Savepoint — seu diário de jogos', description: SITE_DESCRIPTION, path: '/', ownImage: true });
// Título absoluto: o template do layout ("%s · Savepoint") repetiria o nome.
export const metadata: Metadata = { ...homeMeta, title: { absolute: homeMeta.title } };

export default async function HomePage() {
  const [viewer, home] = await Promise.all([getViewer(), api<HomeData>('/home')]);
  const queue = viewer ? await api<QueueData>(`/users/${viewer.username}/queue`).catch(() => null) : null;
  // Um jogo por vez na fileira dos amigos (registros repetidos/replays viram uma capa só).
  const seen = new Set<string>();
  const friends = home.friends.filter((log) => !seen.has(log.game.id) && Boolean(seen.add(log.game.id)));

  return (
    <>
      {viewer ? (
        <section className="shell welcome">
          <h1>
            Bem-vindo de volta, <strong>{viewer.displayName.split(' ')[0]}</strong>. Veja o que seus amigos andam jogando.
          </h1>
          {/* === false: sem a informação (API antiga), não mostra. */}
          {viewer.steamLinked === false && (
            <div className="steam-card">
              <span className="steam-card-icon">
                <Icon name="gamepad" size={22} />
              </span>
              <div>
                <strong>Traga sua biblioteca da Steam</strong>
                <p>Seus jogos e horas jogadas entram na estante de uma vez. Leva menos de um minuto.</p>
              </div>
              <Link href="/settings/steam" className="btn btn-primary">
                Conectar Steam
              </Link>
            </div>
          )}
        </section>
      ) : (
        <section className="hero">
          <CoverWall games={home.trending} />
          <div className="shell hero-inner">
            <h1>
              Cada jogo que você zerou.
              <br />
              <em>E os que ainda vai zerar.</em>
            </h1>
            <p>
              Registre o que jogou, dê nota, escreva reviews, organize seu backlog e descubra o próximo jogo pelo que
              seus amigos estão jogando.
            </p>
            <div className="hero-cta">
              <Link href="/register" className="btn btn-primary btn-lg">
                Criar conta grátis
              </Link>
              <Link href="/games" className="btn btn-lg">
                Explorar catálogo
              </Link>
            </div>
            <p className="hero-note">Projeto de portfólio · entre com demo / savepoint123</p>
            <div className="totals">
              <div className="total">
                <b>{home.totals.games}</b>
                <span>jogos</span>
              </div>
              <div className="total">
                <b>{home.totals.logs}</b>
                <span>registros</span>
              </div>
              <div className="total">
                <b>{home.totals.users}</b>
                <span>jogadores</span>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="shell">
        {viewer && queue && <QueueSection data={queue} username={viewer.username} title="Seu save" isMe />}

        {viewer && friends.length > 0 && (
          <section className="section">
            <SectionHead title="Novidades dos amigos" href="/activity" link="Toda a atividade" />
            <div className="row-posters">
              {friends.slice(0, 6).map((log) => (
                <Poster key={log.id} game={log.game}>
                  <Link href={`/u/${log.user.username}`} title={`${log.user.displayName} ${checkpointVerb(log)} ${log.game.title}`}>
                    <Avatar user={log.user} size={18} />
                  </Link>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <Stars rating={checkpointRating(log)} />
                    {log.note && <Icon name="text" size={11} />}
                  </span>
                </Poster>
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <SectionHead title="Top 10 em alta na comunidade" href="/games" link="Catálogo" />
          <TopRanking games={home.trending} label="Top 10 em alta na comunidade" />
        </section>

        {!viewer && (
          <section className="features">
            <div className="feature">
              <div className="feature-icon">
                <Icon name="check" size={18} />
              </div>
              <h3>Registre tudo</h3>
              <p>Diário com data, plataforma e horas. Zerou, fez 100%, abandonou — sua história com cada jogo fica salva.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <Icon name="star" size={18} />
              </div>
              <h3>Avalie e escreva</h3>
              <p>Notas de meia em meia estrela, likes e reviews (com aviso de spoiler). Seu Top 4 vira seu cartão de visitas.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <Icon name="list" size={18} />
              </div>
              <h3>Organize e descubra</h3>
              <p>Backlog, listas ranqueadas e um feed com o que quem você segue está jogando agora.</p>
            </div>
          </section>
        )}

        <div className="two-col">
          <section className="section">
            <SectionHead title="Reviews populares" />
            {home.popularReviews.map((log) => (
              <Review key={log.id} log={log} canLike={Boolean(viewer)} />
            ))}
            {home.recentReviews.length > 0 && (
              <>
                <div style={{ height: 24 }} />
                <SectionHead title="Recém-escritas" />
                {home.recentReviews.map((log) => (
                  <Review key={log.id} log={log} canLike={Boolean(viewer)} />
                ))}
              </>
            )}
          </section>
          <aside className="section">
            <SectionHead title="Listas" href="/lists" />
            <div style={{ display: 'grid', gap: 28, gridTemplateColumns: 'minmax(0, 1fr)' }}>
              {home.lists.map((l) => (
                <ListCard key={l.id} list={l} />
              ))}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
