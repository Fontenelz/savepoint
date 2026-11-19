import type { LogView, Paginated } from '@savepoint/shared';
import Link from 'next/link';
import { Empty, Pagination, Stars } from '@/components/bits';
import { GameCover } from '@/components/GameCover';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { monthLabel } from '@/lib/format';

/** Diário no estilo "tabela por mês": cada linha é um registro, agrupado pelo mês em que foi jogado. */
export default async function DiaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { username } = await params;
  const { page = '1' } = await searchParams;
  const data = await api<Paginated<LogView>>(`/users/${encodeURIComponent(username)}/diary?page=${page}`);

  if (data.items.length === 0) {
    return (
      <div className="section">
        <Empty title="Diário vazio">
          <p>Abra a página de um jogo e use “Registrar no diário”.</p>
        </Empty>
      </div>
    );
  }

  return (
    <section className="section">
      <table className="diary">
        <thead>
          <tr>
            <th className="c-month">Mês</th>
            <th className="c-day">Dia</th>
            <th className="thumb" />
            <th>Jogo</th>
            <th className="c-rating">Nota</th>
            <th className="hide-sm">Plataforma</th>
            <th className="hide-sm">Horas</th>
            <th className="c-icons" />
          </tr>
        </thead>
        <tbody>
          {data.items.map((log, i) => {
            const key = log.playedOn.slice(0, 7);
            const first = i === 0 || data.items[i - 1].playedOn.slice(0, 7) !== key;
            const { month, year } = monthLabel(log.playedOn);
            return (
              <tr key={log.id}>
                <td className="month">
                  {first && (
                    <div className="month-badge">
                      <b>{month.slice(0, 3)}</b>
                      {year}
                    </div>
                  )}
                </td>
                <td className="day">{Number(log.playedOn.slice(8, 10))}</td>
                <td className="thumb">
                  <Link href={`/games/${log.game.slug}`}>
                    <GameCover game={log.game} />
                  </Link>
                </td>
                <td className="title">
                  <Link href={`/games/${log.game.slug}`}>{log.game.title}</Link>
                  {log.game.releaseYear && <small>{log.game.releaseYear}</small>}
                </td>
                <td>
                  <Stars rating={log.rating} />
                </td>
                <td className="hide-sm muted">{log.platform ?? '—'}</td>
                <td className="hide-sm mono muted">{log.hours != null ? `${Math.round(log.hours)}h` : '—'}</td>
                <td>
                  <span className="icons">
                    {log.liked && <Icon name="heart" size={14} fill className="heart" />}
                    {log.finished && <Icon name="check" size={14} className="" />}
                    {log.replay && <Icon name="replay" size={14} />}
                    {log.review && <Icon name="text" size={14} />}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination page={data.page} totalPages={data.totalPages} hrefFor={(p) => `/u/${username}/diary?page=${p}`} />
    </section>
  );
}
