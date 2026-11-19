import type { CatalogMeta, GameSummary, Paginated } from '@savepoint/shared';
import { formatAvg } from '@savepoint/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, Pagination, Poster } from '@/components/bits';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Jogos' };

type Search = { q?: string; genre?: string; platform?: string; sort?: string; page?: string };

export default async function GamesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) params.set(k, v);

  const [meta, data] = await Promise.all([
    api<CatalogMeta>('/meta'),
    api<Paginated<GameSummary>>(`/games?${params}`),
  ]);

  const hrefFor = (page: number) => {
    const p = new URLSearchParams(params);
    p.set('page', String(page));
    return `/games?${p}`;
  };

  return (
    <div className="shell">
      <div className="page-head">
        <h1 className="page-title">{sp.q ? `Resultados para “${sp.q}”` : 'Catálogo'}</h1>
        <p>
          {data.total} {data.total === 1 ? 'jogo' : 'jogos'} · catálogo próprio, mantido pela comunidade.{' '}
          <Link href="/games/new" style={{ color: 'var(--accent)' }}>
            Não achou? Cadastre.
          </Link>
        </p>
      </div>

      <form className="filter-bar" action="/games">
        <input className="input" name="q" defaultValue={sp.q} placeholder="Título…" aria-label="Título" />
        <select className="select" name="genre" defaultValue={sp.genre ?? ''} aria-label="Gênero">
          <option value="">Todos os gêneros</option>
          {meta.genres.map((g) => (
            <option key={g.id} value={g.slug}>
              {g.name}
            </option>
          ))}
        </select>
        <select className="select" name="platform" defaultValue={sp.platform ?? ''} aria-label="Plataforma">
          <option value="">Todas as plataformas</option>
          {meta.platforms.map((p) => (
            <option key={p.id} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
        <select className="select" name="sort" defaultValue={sp.sort ?? 'popular'} aria-label="Ordenar">
          <option value="popular">Mais populares</option>
          <option value="rating">Melhor avaliados</option>
          <option value="recent">Lançamento</option>
          <option value="title">A–Z</option>
        </select>
        <button className="btn">Filtrar</button>
        {params.toString() && (
          <Link href="/games" className="btn btn-ghost">
            Limpar
          </Link>
        )}
      </form>

      {data.items.length === 0 ? (
        <Empty title="Nenhum jogo encontrado">
          <p>
            Tente outro filtro ou <Link href="/games/new">cadastre o jogo</Link>.
          </p>
        </Empty>
      ) : (
        <div className="grid-posters">
          {data.items.map((g) => (
            <Poster key={g.id} game={g}>
              <span className="stars" style={{ fontSize: 11 }}>
                {g.ratingAvg ? `★ ${formatAvg(g.ratingAvg)}` : ''}
              </span>
              <span>{g.releaseYear}</span>
            </Poster>
          ))}
        </div>
      )}
      <Pagination page={data.page} totalPages={data.totalPages} hrefFor={hrefFor} />
    </div>
  );
}
