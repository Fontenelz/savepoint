import type { GameSummary } from '@savepoint/shared';
import { Poster } from './bits';
import { Slider } from './Slider';

/** Top 10 em carrossel, com o número da posição gigante e vazado atrás de cada capa. */
export function TopRanking({ games, label }: { games: GameSummary[]; label: string }) {
  return (
    <Slider label={label} size="rank">
      {games.slice(0, 10).map((g, i) => (
        <div key={g.id} className="rank-item">
          <span className="rank-num" aria-hidden>
            {i + 1}
          </span>
          <span className="sr-only">{i + 1}º lugar:</span>
          <div className="rank-cover">
            <Poster game={g} />
          </div>
        </div>
      ))}
    </Slider>
  );
}
