import type { ListDetail } from '@savepoint/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, Poster, UserLink } from '@/components/bits';
import { Icon } from '@/components/Icon';
import { api, apiOrNotFound } from '@/lib/api';
import { metaDescription, publicPageMeta } from '@/lib/site';
import { relativeTime } from '@/lib/format';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const list = await api<ListDetail>(`/lists/${id}`);
    const resumo = `Lista de ${list.itemCount} ${list.itemCount === 1 ? 'jogo' : 'jogos'} por @${list.user.username} no Savepoint.`;
    return publicPageMeta({
      title: list.title,
      description: metaDescription(list.description ? `${list.description} · ${resumo}` : resumo),
      path: `/lists/${list.id}`,
      ownImage: true,
      type: 'article',
    });
  } catch {
    return { title: 'Lista' };
  }
}

export default async function ListPage({ params }: Props) {
  const { id } = await params;
  const list = await apiOrNotFound<ListDetail>(`/lists/${id}`);

  return (
    <div className="shell">
      <header className="list-detail-head">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }} className="muted">
          <UserLink user={list.user} />
          <span>atualizada {relativeTime(list.updatedAt)}</span>
          {list.ranked && <span className="tag">Ranking</span>}
        </div>
        <h1 className="page-title">{list.title}</h1>
        {list.description && <p>{list.description}</p>}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="muted">
            {list.itemCount} {list.itemCount === 1 ? 'jogo' : 'jogos'}
          </span>
          {list.isOwner && (
            <Link href={`/lists/${list.id}/edit`} className="btn btn-sm">
              <Icon name="edit" size={13} /> Editar
            </Link>
          )}
        </div>
      </header>

      <div className="section">
        {list.items.length === 0 ? (
          <Empty title="Lista vazia" />
        ) : (
          <div className={`grid-posters lg ${list.ranked ? 'ranked' : ''}`}>
            {list.items.map((item) => (
              <div key={item.game.id}>
                <Poster game={item.game} />
                {list.ranked && <span className="poster-rank">{item.position}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
