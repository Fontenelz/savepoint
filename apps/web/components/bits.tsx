import {
  PLAY_STATUS_LABEL,
  formatAvg,
  ratingToStars,
  type GameSummary,
  type ListSummary,
  type PlayStatus,
  type UserSummary,
} from '@savepoint/shared';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { GameCover } from './GameCover';
import { Icon, STATUS_COLOR, STATUS_ICON } from './Icon';

export function Stars({ rating, className = '' }: { rating: number | null | undefined; className?: string }) {
  if (!rating) return null;
  return (
    <span className={`stars ${className}`} title={`${(rating / 2).toString().replace('.', ',')} estrelas`}>
      {ratingToStars(rating)}
    </span>
  );
}

export function Avatar({ user, size = 32 }: { user: Pick<UserSummary, 'displayName' | 'avatarHue'>; size?: number }) {
  const initials = user.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  return (
    <span className="avatar" style={{ '--h': user.avatarHue, '--size': `${size}px` } as CSSProperties} aria-hidden>
      {initials}
    </span>
  );
}

export function UserLink({ user, size = 22 }: { user: UserSummary; size?: number }) {
  return (
    <Link href={`/u/${user.username}`} className="user-line">
      <Avatar user={user} size={size} />
      {user.displayName}
    </Link>
  );
}

export function Poster({
  game,
  status,
  children,
  tip = true,
}: {
  game: GameSummary;
  status?: PlayStatus | null;
  children?: ReactNode;
  tip?: boolean;
}) {
  return (
    <div>
      <Link href={`/games/${game.slug}`} className="poster" aria-label={game.title}>
        {tip && (
          <span className="poster-tip">
            {game.title}
            {game.releaseYear ? ` (${game.releaseYear})` : ''}
          </span>
        )}
        {status && (
          <span className="status-pip" style={{ '--pip': STATUS_COLOR[status] } as CSSProperties} title={PLAY_STATUS_LABEL[status]}>
            <Icon name={STATUS_ICON[status]} size={11} />
          </span>
        )}
        <GameCover game={game} />
      </Link>
      {children && <div className="poster-meta">{children}</div>}
    </div>
  );
}

export function SectionHead({ title, href, link = 'Ver mais' }: { title: string; href?: string; link?: string }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {href && <Link href={href}>{link}</Link>}
    </div>
  );
}

export function ListCard({ list }: { list: ListSummary }) {
  const slots = [...list.preview, ...Array(Math.max(0, 5 - list.preview.length)).fill(null)] as (GameSummary | null)[];
  return (
    <Link href={`/lists/${list.id}`} className="list-card">
      <div className="list-stack">
        {slots.map((g, i) => (g ? <GameCover key={g.id} game={g} /> : <div key={i} className="cover cover-placeholder" />))}
      </div>
      <h3>{list.title}</h3>
      <div className="list-meta">
        <span className="user-line">
          <Avatar user={list.user} size={18} />
          {list.user.displayName}
        </span>
        <span>
          {list.itemCount} {list.itemCount === 1 ? 'jogo' : 'jogos'}
        </span>
        {list.ranked && <span className="tag">Ranking</span>}
      </div>
    </Link>
  );
}

export function Histogram({ histogram, avg, count }: { histogram: number[]; avg: number | null; count: number }) {
  const max = Math.max(1, ...histogram);
  return (
    <div className="ratings">
      <div>
        <div className="histogram">
          {histogram.map((n, i) => (
            <div
              key={i}
              className="bar"
              style={{ height: `${Math.max(3, (n / max) * 100)}%` }}
              data-tip={`${n} × ${ratingToStars(i + 1)}`}
            />
          ))}
        </div>
        <div className="histogram-axis">
          <span>★</span>
          <span>★★★★★</span>
        </div>
      </div>
      <div className="avg">
        <b>{formatAvg(avg)}</b>
        <span>{count} notas</span>
      </div>
    </div>
  );
}

export function ShelfBar({
  counts,
  hrefFor,
}: {
  counts: Record<PlayStatus, number>;
  hrefFor?: (s: PlayStatus) => string;
}) {
  const entries = (Object.keys(counts) as PlayStatus[]).filter((s) => counts[s] > 0);
  const total = entries.reduce((n, s) => n + counts[s], 0);
  if (!total) return <p className="muted">Ninguém registrou ainda.</p>;
  return (
    <div>
      <div className="shelf-bar">
        {entries.map((s) => (
          <i key={s} style={{ width: `${(counts[s] / total) * 100}%`, '--st': STATUS_COLOR[s] } as CSSProperties} title={PLAY_STATUS_LABEL[s]} />
        ))}
      </div>
      <div className="shelf-legend">
        {entries.map((s) => {
          const inner = (
            <>
              <i style={{ '--st': STATUS_COLOR[s] } as CSSProperties} />
              {PLAY_STATUS_LABEL[s]}
              <b>{counts[s]}</b>
            </>
          );
          return hrefFor ? (
            <Link key={s} href={hrefFor(s)}>
              {inner}
            </Link>
          ) : (
            <span key={s}>{inner}</span>
          );
        })}
      </div>
    </div>
  );
}

export function Pagination({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (p: number) => string }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Paginação">
      {page > 1 ? (
        <Link className="btn btn-sm" href={hrefFor(page - 1)}>
          ← Anterior
        </Link>
      ) : (
        <span className="btn btn-sm" aria-disabled style={{ opacity: 0.4 }}>
          ← Anterior
        </span>
      )}
      <span className="mono">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link className="btn btn-sm" href={hrefFor(page + 1)}>
          Próxima →
        </Link>
      ) : (
        <span className="btn btn-sm" aria-disabled style={{ opacity: 0.4 }}>
          Próxima →
        </span>
      )}
    </nav>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

/** Mosaico de capas inclinado usado como fundo no hero e no login. */
export function CoverWall({ games }: { games: GameSummary[] }) {
  if (!games.length) return null;
  const tiles = Array.from({ length: 50 }, (_, i) => games[(i * 7) % games.length]);
  return (
    <div className="hero-wall" aria-hidden>
      {tiles.map((g, i) => (
        <GameCover key={i} game={g} />
      ))}
    </div>
  );
}
