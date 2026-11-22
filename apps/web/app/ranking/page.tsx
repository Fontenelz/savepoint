import { formatAvg, type RankingData } from '@savepoint/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty } from '@/components/bits';
import { GameCover } from '@/components/GameCover';
import { api } from '@/lib/api';
import { plural } from '@/lib/format';
import { publicPageMeta } from '@/lib/site';

export const metadata: Metadata = publicPageMeta({
  title: 'Ranking',
  description: 'Os jogos mais bem avaliados do catálogo do Savepoint, pelas avaliações dos jogadores na Steam.',
  path: '/ranking',
});

const thousands = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default async function RankingPage() {
  const { items, method } = await api<RankingData>('/ranking');

  return (
    <div className="shell">
      <div className="page-head">
        <h1 className="page-title">Ranking</h1>
        <p>Os jogos mais bem avaliados do catálogo, pelas avaliações dos jogadores na Steam.</p>
        <details className="ranking-method">
          <summary>Como a nota do ranking é calculada</summary>
          <p>
            A nota parte da porcentagem de avaliações positivas na loja da Steam, ajustada pela quantidade de
            avaliações (a mesma fórmula do{' '}
            <a href="https://steamdb.info/blog/steamdb-rating/" target="_blank" rel="noreferrer">
              SteamDB
            </a>
            ):
          </p>
          <p className="ranking-formula">% positivas − (% positivas − 50%) × 2^(−log₁₀(avaliações + 1))</p>
          <p>
            Com poucas avaliações, a nota fica mais perto de 50%: 99% de 2 mil avaliações não passa à frente de 98% de
            959 mil. Com muitas, fica praticamente igual à porcentagem da loja.
          </p>
          {method.gamesWithoutSteam > 0 && (
            <p>
              {plural(method.gamesWithoutSteam, 'jogo do catálogo não tem', 'jogos do catálogo não têm')} avaliações
              na Steam (como os exclusivos de console) e {method.gamesWithoutSteam === 1 ? 'fica' : 'ficam'} fora do
              ranking.
            </p>
          )}
        </details>
      </div>

      <div className="section">
        {items.length === 0 ? (
          <Empty title="Ranking indisponível">Nenhum jogo do catálogo tem avaliações da Steam ainda.</Empty>
        ) : (
          <ol className="ranking">
            {items.map((r) => (
              <li key={r.game.id} className="ranking-row">
                <span className="ranking-pos">{r.position}</span>
                <Link href={`/games/${r.game.slug}`} className="ranking-cover" tabIndex={-1} aria-hidden>
                  <GameCover game={r.game} />
                </Link>
                <div className="ranking-info">
                  <Link href={`/games/${r.game.slug}`} className="ranking-title">
                    {r.game.title}
                    {r.game.releaseYear ? <small>{r.game.releaseYear}</small> : null}
                  </Link>
                  <div className="ranking-sources">
                    <span title="Avaliações positivas na loja da Steam">
                      <b>Steam</b> {r.steam.score}% · {thousands.format(r.steam.reviews)} avaliações
                    </span>
                    {r.community && (
                      <span title="Média das notas dadas aqui no Savepoint (não entra no ranking)">
                        <b>Comunidade</b> {formatAvg(r.community.avg)}★ · {plural(r.community.count, 'nota', 'notas')}
                      </span>
                    )}
                  </div>
                </div>
                <span className="ranking-score" aria-label={`Nota do ranking: ${percent.format(r.score * 100)}%`}>
                  {percent.format(r.score * 100)}%
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
