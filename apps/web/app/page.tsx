import { PLAY_STATUS_VERB, type HomeData } from '@savepoint/shared';
import Link from 'next/link';
import { Avatar, CoverWall, ListCard, Poster, SectionHead, Stars } from '@/components/bits';
import { Icon } from '@/components/Icon';
import { Review } from '@/components/Review';
import { api } from '@/lib/api';
import { getViewer } from '@/lib/session';

export default async function HomePage() {
  const [viewer, home] = await Promise.all([getViewer(), api<HomeData>('/home')]);
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
        {viewer && friends.length > 0 && (
          <section className="section">
            <SectionHead title="Novidades dos amigos" href="/activity" link="Toda a atividade" />
            <div className="row-posters">
              {friends.slice(0, 6).map((log) => (
                <Poster key={log.id} game={log.game}>
                  <Link href={`/u/${log.user.username}`} title={`${log.user.displayName} ${log.finished ? 'zerou' : PLAY_STATUS_VERB.PLAYING}`}>
                    <Avatar user={log.user} size={18} />
                  </Link>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <Stars rating={log.rating} />
                    {log.liked && <Icon name="heart" size={11} fill className="heart" />}
                    {log.review && <Icon name="text" size={11} />}
                  </span>
                </Poster>
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <SectionHead title="Em alta na comunidade" href="/games" link="Catálogo" />
          <div className="row-posters">
            {home.trending.slice(0, 12).map((g) => (
              <Poster key={g.id} game={g} />
            ))}
          </div>
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
