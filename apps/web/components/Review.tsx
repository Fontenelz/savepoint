import type { LogView } from '@savepoint/shared';
import Link from 'next/link';
import { shortDate } from '@/lib/format';
import { Poster, Stars, UserLink } from './bits';
import { Icon } from './Icon';
import { LikeButton } from './LikeButton';
import { ReviewThread } from './ReviewThread';

/** Card de review — usado na home, na página do jogo e no perfil. */
export function Review({
  log,
  showGame = true,
  canLike,
}: {
  log: LogView;
  showGame?: boolean;
  canLike: boolean;
}) {
  return (
    <article className={`review ${showGame ? '' : 'no-cover'}`}>
      {showGame && <Poster game={log.game} tip={false} />}
      <div>
        {showGame && (
          <Link href={`/games/${log.game.slug}`} className="review-game">
            {log.game.title}
            {log.game.releaseYear && <small>{log.game.releaseYear}</small>}
          </Link>
        )}
        <div className="review-head">
          <UserLink user={log.user} />
          <Stars rating={log.rating} />
          {log.liked && <Icon name="heart" size={13} fill className="heart" />}
          {log.replay && (
            <span className="tag">
              <Icon name="replay" size={12} /> Rejogou
            </span>
          )}
          {log.finished && !log.replay && (
            <span className="tag" style={{ color: 'var(--st-completed)' }}>
              <Icon name="check" size={12} /> Zerou
            </span>
          )}
        </div>
        {log.review &&
          (log.spoiler ? (
            <details className="spoiler">
              <summary>Esta review contém spoilers — mostrar mesmo assim</summary>
              <p className="review-body">{log.review}</p>
            </details>
          ) : (
            <p className="review-body">{log.review}</p>
          ))}
        <ReviewThread logId={log.id} initialCount={log.commentCount} canReply={canLike}>
          <LikeButton logId={log.id} initialLiked={log.viewerLiked} initialCount={log.likeCount} enabled={canLike} />
          <span className="foot-meta">
            {shortDate(log.playedOn)}
            {log.platform && ` · ${log.platform}`}
            {log.hours != null && ` · ${Math.round(log.hours)}h`}
          </span>
        </ReviewThread>
      </div>
    </article>
  );
}
