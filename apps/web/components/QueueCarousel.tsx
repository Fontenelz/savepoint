import { formatHours, type QueueData, type QueueItem } from '@savepoint/shared';
import Link from 'next/link';
import { GameCover } from './GameCover';
import { Icon } from './Icon';
import { Slider } from './Slider';

/** Carrossel "Seu save": primeiro o que está jogando, depois a fila (Quero jogar). */
export function QueueCarousel({ data, label }: { data: QueueData; label: string }) {
  const items = [...data.playing, ...data.backlog];
  return (
    <Slider label={label} size="lg">
      {items.map((item) => (
        <QueueCard key={item.game.id} item={item} />
      ))}
    </Slider>
  );
}

function QueueCard({ item }: { item: QueueItem }) {
  const { game, state } = item;
  const playing = state.status === 'PLAYING';
  const hours = state.hoursPlayed;
  const pct = playing && game.avgHours && hours != null ? Math.min(100, Math.round((hours / game.avgHours) * 100)) : null;

  return (
    <Link href={`/games/${game.slug}`} className={`queue-card ${playing ? 'is-playing' : 'is-backlog'}`}>
      <div className="queue-cover">
        <GameCover game={game} />
        <span className="queue-badge">
          <Icon name={playing ? 'play' : 'bookmark'} size={11} fill={playing} />
          {playing ? 'Jogando' : 'Quero jogar'}
        </span>
      </div>
      <div className="queue-info">
        <strong>{game.title}</strong>
        {playing ? (
          pct != null ? (
            <>
              <div className="queue-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso estimado">
                <i style={{ width: `${pct}%` }} />
              </div>
              <span className="queue-hours">{`${formatHours(hours)} de ~${formatHours(game.avgHours)}`}</span>
            </>
          ) : (
            <span>{hours ? `${formatHours(hours)} jogadas` : 'Começou agora'}</span>
          )
        ) : (
          <span>
            {game.avgHours ? (
              <>
                <Icon name="clock" size={11} />
                {`~${formatHours(game.avgHours)} para zerar`}
              </>
            ) : (
              'Na fila'
            )}
          </span>
        )}
      </div>
    </Link>
  );
}

/** Seção completa "Seu save": cabeçalho com contagens + carrossel (ou convite, se vazio). */
export function QueueSection({
  data,
  username,
  title,
  isMe,
}: {
  data: QueueData;
  username: string;
  title: string;
  isMe: boolean;
}) {
  const total = data.playing.length + data.backlog.length;
  if (!total && !isMe) return null;

  return (
    <section className="queue-section">
      <div className="section-head">
        <h2>{title}</h2>
        <div className="queue-counts">
          <Link href={`/u/${username}/games?filter=PLAYING`} className="c-playing">
            <b>{data.playing.length}</b> jogando
          </Link>
          <Link href={`/u/${username}/games?filter=BACKLOG`} className="c-backlog">
            <b>{data.backlog.length}</b> na fila
          </Link>
        </div>
      </div>
      {total ? (
        <QueueCarousel data={data} label={title} />
      ) : (
        <div className="queue-empty">
          <span>Marque jogos como “Jogando” ou “Quero jogar” para acompanhá-los aqui.</span>
          <Link href="/games" className="btn btn-primary btn-sm">
            Explorar jogos
          </Link>
        </div>
      )}
    </section>
  );
}
