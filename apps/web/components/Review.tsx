import { PLAY_STATUS_LABEL, type ReviewView } from '@savepoint/shared';
import Link from 'next/link';
import { reviewPath, shortDate } from '@/lib/format';
import { Poster, Stars, UserLink } from './bits';
import { Icon, STATUS_COLOR, STATUS_ICON } from './Icon';
import { LikeButton } from './LikeButton';
import { ReviewThread } from './ReviewThread';

/** Card de review (avaliação de um save) — usado na home, na página do jogo e no perfil. */
export function Review({
  log,
  showGame = true,
  canLike,
}: {
  log: ReviewView;
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
          <span className="tag" style={{ color: STATUS_COLOR[log.save.status] }}>
            <Icon name={STATUS_ICON[log.save.status]} size={12} /> {PLAY_STATUS_LABEL[log.save.status]}
          </span>
          {log.save.number > 1 && (
            <span className="tag" title="Rejogou: esta é a avaliação de uma nova jornada">
              <Icon name="save" size={12} /> Save {log.save.number}
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
            <Link href={reviewPath(log)} title="Link desta review">
              {shortDate(log.save.endedAt ?? log.createdAt)}
            </Link>
            {log.platform && ` · ${log.platform}`}
            {log.hours != null && ` · ${Math.round(log.hours)}h`}
          </span>
        </ReviewThread>
      </div>
    </article>
  );
}
