import type { ListDetail } from '@savepoint/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ListBuilder } from '@/components/ListBuilder';
import { apiOrNotFound } from '@/lib/api';
import { getViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Editar lista' };

export default async function EditListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/lists/${id}/edit`);
  const list = await apiOrNotFound<ListDetail>(`/lists/${id}`);
  if (!list.isOwner) redirect(`/lists/${id}`);

  return (
    <div className="shell form-page">
      <div className="page-head">
        <h1 className="page-title">Editar lista</h1>
      </div>
      <div className="section">
        <ListBuilder
          listId={list.id}
          owner={viewer.username}
          initial={{
            title: list.title,
            description: list.description ?? '',
            ranked: list.ranked,
            games: list.items.map((i) => i.game),
          }}
        />
      </div>
    </div>
  );
}
