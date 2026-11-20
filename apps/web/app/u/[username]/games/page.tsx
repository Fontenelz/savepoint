import {
  LIBRARY_FILTERS,
  PLAY_STATUSES,
  PLAY_STATUS_LABEL,
  type LibraryFilter,
  type LibraryItem,
  type Paginated,
  type PlayStatus,
} from '@savepoint/shared';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Empty, Pagination, Poster, Stars } from '@/components/bits';
import { Icon, STATUS_COLOR } from '@/components/Icon';
import { api } from '@/lib/api';
import { getProfile } from '@/lib/profile';

const LABEL: Record<string, string> = { all: 'Tudo', played: 'Jogados', liked: 'Curtidos', rated: 'Avaliados' };

export default async function LibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const { username } = await params;
  const sp = await searchParams;
  const filter = (LIBRARY_FILTERS as readonly string[]).includes(sp.filter ?? '') ? (sp.filter as LibraryFilter) : 'all';
  const page = sp.page ?? '1';
  const [profile, data] = await Promise.all([
    getProfile(username),
    api<Paginated<LibraryItem>>(`/users/${encodeURIComponent(username)}/games?filter=${filter}&page=${page}`),
  ]);
  const base = `/u/${profile.user.username}/games`;

  return (
    <section>
      <div className="filter-bar">
        {(['all', 'played', 'liked', 'rated'] as const).map((f) => (
          <Link key={f} href={`${base}?filter=${f}`} className={`pill ${filter === f ? 'on' : ''}`}>
            {LABEL[f]}
          </Link>
        ))}
        <span style={{ width: 1, height: 20, background: 'var(--line)', margin: '0 4px' }} />
        {PLAY_STATUSES.map((s: PlayStatus) => (
          <Link
            key={s}
            href={`${base}?filter=${s}`}
            className={`pill ${filter === s ? 'on' : ''}`}
            style={{ '--st': STATUS_COLOR[s] } as CSSProperties}
          >
            {PLAY_STATUS_LABEL[s]} <b>{profile.statusCounts[s]}</b>
          </Link>
        ))}
      </div>

      {data.items.length === 0 ? (
        <Empty title="Nada por aqui">
          <p>Nenhum jogo neste filtro.</p>
        </Empty>
      ) : (
        <div className="grid-posters">
          {data.items.map(({ game, state }) => (
            <Poster key={game.id} game={game} status={state.status}>
              {state.rating ? (
                <Stars rating={state.rating} />
              ) : profile.isMe && state.suggested ? (
                // Só o dono vê a sugestão: para visitantes pareceria a nota dele.
                <span className="stars-suggested" title={`Nota sugerida pela Steam (${state.suggested.steamScore}% positivas)`}>
                  <Stars rating={state.suggested.rating} />
                </span>
              ) : null}
              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {state.liked && <Icon name="heart" size={11} fill className="heart" />}
                {state.hoursPlayed != null && <span className="mono">{Math.round(state.hoursPlayed)}h</span>}
              </span>
            </Poster>
          ))}
        </div>
      )}
      <Pagination page={data.page} totalPages={data.totalPages} hrefFor={(p) => `${base}?filter=${filter}&page=${p}`} />
    </section>
  );
}
