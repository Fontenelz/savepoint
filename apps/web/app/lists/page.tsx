import type { ListSummary, Paginated } from '@savepoint/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, ListCard, Pagination } from '@/components/bits';
import { api } from '@/lib/api';
import { getViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Listas' };

export default async function ListsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page = '1' } = await searchParams;
  const [viewer, data] = await Promise.all([getViewer(), api<Paginated<ListSummary>>(`/lists?page=${page}`)]);

  return (
    <div className="shell">
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Listas</h1>
          <p>Coleções, rankings e recomendações feitas pela comunidade.</p>
        </div>
        <Link href={viewer ? '/lists/new' : '/login?next=/lists/new'} className="btn btn-primary">
          Criar lista
        </Link>
      </div>
      <div className="section">
        {data.items.length === 0 ? (
          <Empty title="Nenhuma lista ainda" />
        ) : (
          <div className="grid-lists">
            {data.items.map((l) => (
              <ListCard key={l.id} list={l} />
            ))}
          </div>
        )}
      </div>
      <Pagination page={data.page} totalPages={data.totalPages} hrefFor={(p) => `/lists?page=${p}`} />
    </div>
  );
}
