import type { GameDetail, GameSummary } from '@savepoint/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ListBuilder } from '@/components/ListBuilder';
import { api } from '@/lib/api';
import { getViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Nova lista' };

export default async function NewListPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/lists/new');

  // ?add=<slug> vem do botão "Nova lista" na página de um jogo: a lista já começa com ele.
  const { add } = await searchParams;
  const games: GameSummary[] = [];
  if (add) {
    const game = await api<GameDetail>(`/games/${encodeURIComponent(add)}`).catch(() => null);
    if (game) games.push(game);
  }

  return (
    <div className="shell form-page">
      <div className="page-head">
        <h1 className="page-title">Nova lista</h1>
        <p>Rankings, recomendações, desafios… do jeito que você quiser.</p>
      </div>
      <div className="section">
        <ListBuilder listId={null} owner={viewer.username} initial={{ title: '', description: '', ranked: false, games }} />
      </div>
    </div>
  );
}
