import { formatAvg, type RankingData } from '@savepoint/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty } from '@/components/bits';
import { GameCover } from '@/components/GameCover';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { plural } from '@/lib/format';
import { publicPageMeta } from '@/lib/site';

export const metadata: Metadata = publicPageMeta({
  title: 'Ranking',
  description: 'Os jogos mais bem avaliados pela comunidade do Savepoint, com a referência das avaliações da Steam.',
  path: '/ranking',
});

const thousands = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 0 });

export default async function RankingPage() {
  const { items, method } = await api<RankingData>('/ranking');

  return (
    <div className="shell">
      <div className="page-head">
        <h1 className="page-title">Ranking</h1>
        <p>Os jogos mais bem avaliados pela comunidade.</p>
        <details className="ranking-method">
          <summary>Como a nota do ranking é calculada</summary>
          <p>
            Entra todo jogo com ao menos uma nota da comunidade. Com poucas notas, a média de um jogo muda muito a
            cada voto — por isso ela é combinada com uma referência, que vale como{' '}
            {plural(method.priorVotes, 'nota', 'notas')}:
          </p>
          <p className="ranking-formula">
            (notas × média da comunidade + {method.priorVotes} × referência) ÷ (notas + {method.priorVotes})
          </p>
          <p>
            A referência são as avaliações da loja da Steam (a partir de {method.minSteamReviews}); sem elas, a média de
            todas as notas do site{method.siteAvg != null ? ` (${formatAvg(method.siteAvg)}★)` : ''}. Conforme a
            comunidade avalia um jogo, a nota dela passa a pesar mais que a referência.
          </p>
        </details>
      </div>

      <div className="section">
        {items.length === 0 ? (
          <Empty title="Nenhum jogo avaliado ainda">Dê nota aos jogos que você jogou para montar o ranking.</Empty>
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
                    <span title="Média das notas dadas aqui no Savepoint">
                      <b>Comunidade</b> {formatAvg(r.community.avg)}★ · {plural(r.community.count, 'nota', 'notas')}
                    </span>
                    {r.steam && (
                      <span title="Avaliações positivas na loja da Steam">
                        <b>Steam</b> {r.steam.score}% · {thousands.format(r.steam.reviews)} avaliações
                      </span>
                    )}
                  </div>
                </div>
                <span className="ranking-score" aria-label={`Nota do ranking: ${formatAvg(r.score)} de 5`}>
                  <Icon name="star" size={16} fill />
                  {(r.score / 2).toFixed(2).replace('.', ',')}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
