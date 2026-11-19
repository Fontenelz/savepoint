import type { ListSummary } from '@savepoint/shared';
import Link from 'next/link';
import { Empty, ListCard } from '@/components/bits';
import { api } from '@/lib/api';
import { getProfile } from '@/lib/profile';

export default async function UserListsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [profile, lists] = await Promise.all([
    getProfile(username),
    api<ListSummary[]>(`/users/${encodeURIComponent(username)}/lists`),
  ]);

  return (
    <section className="section">
      {profile.isMe && (
        <div style={{ marginBottom: 20 }}>
          <Link href="/lists/new" className="btn btn-primary">
            Nova lista
          </Link>
        </div>
      )}
      {lists.length === 0 ? (
        <Empty title="Nenhuma lista ainda" />
      ) : (
        <div className="grid-lists">
          {lists.map((l) => (
            <ListCard key={l.id} list={l} />
          ))}
        </div>
      )}
    </section>
  );
}
