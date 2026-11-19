import type { GameSummary, Paginated } from '@savepoint/shared';
import { api } from '@/lib/api';
import { CoverWall } from './bits';

export async function AuthArt({ quote }: { quote: string }) {
  const games = await api<Paginated<GameSummary>>('/games?sort=popular').catch(() => null);
  return (
    <div className="auth-art">
      <CoverWall games={games?.items ?? []} />
      <p className="auth-quote">{quote}</p>
    </div>
  );
}
