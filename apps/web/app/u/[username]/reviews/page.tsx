import type { Paginated, ReviewView } from '@savepoint/shared';
import { Empty, Pagination } from '@/components/bits';
import { Review } from '@/components/Review';
import { api } from '@/lib/api';
import { getViewer } from '@/lib/session';

export default async function ReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { username } = await params;
  const { page = '1' } = await searchParams;
  const [viewer, data] = await Promise.all([
    getViewer(),
    api<Paginated<ReviewView>>(`/users/${encodeURIComponent(username)}/reviews?page=${page}`),
  ]);

  return (
    <section className="section" style={{ maxWidth: 780 }}>
      {data.items.length === 0 ? (
        <Empty title="Nenhuma review ainda" />
      ) : (
        data.items.map((log) => <Review key={log.id} log={log} canLike={Boolean(viewer)} />)
      )}
      <Pagination page={data.page} totalPages={data.totalPages} hrefFor={(p) => `/u/${username}/reviews?page=${p}`} />
    </section>
  );
}
