import type { CheckpointView, Paginated, UserSummary } from '@savepoint/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Avatar, Empty, Pagination, SectionHead, Stars } from '@/components/bits';
import { FollowButton } from '@/components/FollowButton';
import { GameCover } from '@/components/GameCover';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { relativeTime, shortDate } from '@/lib/format';
import { checkpointRating, checkpointVerb } from '@/lib/journey';
import { getViewer } from '@/lib/session';

// Página pessoal: fora da busca.
export const metadata: Metadata = { title: 'Atividade', robots: { index: false, follow: false } };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/activity');
  const { page = '1' } = await searchParams;
  const [feed, suggestions] = await Promise.all([
    api<Paginated<CheckpointView>>(`/feed?page=${page}`),
    api<(UserSummary & { bio: string | null })[]>('/me/suggestions'),
  ]);

  return (
    <div className="shell">
      <div className="page-head">
        <h1 className="page-title">Atividade</h1>
        <p>O que as pessoas que você segue andam jogando.</p>
      </div>
      <div className="two-col">
        <section className="section">
          {feed.items.length === 0 ? (
            <Empty title="Seu feed está vazio">
              <p>Siga algumas pessoas para ver o que elas estão jogando.</p>
            </Empty>
          ) : (
            feed.items.map((log) => (
              <article key={log.id} className="feed-item">
                <Link href={`/u/${log.user.username}`}>
                  <Avatar user={log.user} size={32} />
                </Link>
                <div>
                  <p>
                    <Link href={`/u/${log.user.username}`}>
                      <b>{log.user.displayName}</b>
                    </Link>{' '}
                    {checkpointVerb(log)}{' '}
                    <Link className="game" href={`/games/${log.game.slug}`}>
                      {log.game.title}
                    </Link>{' '}
                    <Stars rating={checkpointRating(log)} />{' '}
                    {log.save.number > 1 && log.kind !== 'STARTED' && <span className="tag">Save {log.save.number}</span>}
                  </p>
                  <div className="when">
                    {shortDate(log.playedOn)}
                    {log.platform && ` · ${log.platform}`}
                    {log.hours != null && ` · ${Math.round(log.hours)}h`} · {relativeTime(log.createdAt)}
                  </div>
                  {log.note && !log.spoiler && <blockquote>{log.note}</blockquote>}
                  {log.note && log.spoiler && <blockquote className="muted">Anotação com spoilers.</blockquote>}
                  {log.kind === 'CLOSED' && log.save.hasReview && (
                    <Link href={`/games/${log.game.slug}#reviews`} className="muted" style={{ fontSize: 13 }}>
                      <Icon name="text" size={12} /> Ler a review
                    </Link>
                  )}
                </div>
                <Link href={`/games/${log.game.slug}`}>
                  <GameCover game={log.game} />
                </Link>
              </article>
            ))
          )}
          <Pagination page={feed.page} totalPages={feed.totalPages} hrefFor={(p) => `/activity?page=${p}`} />
        </section>
        <aside className="section">
          <SectionHead title="Quem seguir" />
          {suggestions.length === 0 ? (
            <p className="muted">Você já segue todo mundo por aqui. 👀</p>
          ) : (
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1fr)' }}>
              {suggestions.map((u) => (
                <div key={u.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Avatar user={u} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/u/${u.username}`} style={{ fontWeight: 600 }}>
                      {u.displayName}
                    </Link>
                    <div className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.bio}
                    </div>
                  </div>
                  <FollowButton username={u.username} initial={false} />
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
