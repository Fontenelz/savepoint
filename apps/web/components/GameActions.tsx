'use client';

import {
  PLAY_STATUSES,
  PLAY_STATUS_LABEL,
  type GameSummary,
  type LibraryEntryInput,
  type Platform,
  type PlayStatus,
  type UserGameState,
} from '@savepoint/shared';
import Link from 'next/link';
import { useEffect, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { addToListAction, removeFromLibraryAction, saveLibraryAction, toggleFavoriteAction } from '@/app/actions';
import { Icon, STATUS_COLOR, STATUS_ICON } from './Icon';
import { LogDialog } from './LogDialog';
import { StarInput } from './StarInput';

const EMPTY: UserGameState = {
  status: null,
  rating: null,
  liked: false,
  favoriteRank: null,
  platformId: null,
  hoursPlayed: null,
  startedAt: null,
  finishedAt: null,
};

const OPEN_LOG_EVENT = 'sp:open-log';

/** Abre o diálogo de registro/review do painel de ações a partir de outro ponto da página. */
export function OpenLogButton({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="btn btn-sm" onClick={() => window.dispatchEvent(new Event(OPEN_LOG_EVENT))}>
      <Icon name="edit" size={14} /> {children}
    </button>
  );
}

/** Painel lateral da página do jogo: status, nota, like, favorito, diário e listas. */
export function GameActions({
  game,
  platforms,
  initial,
  loggedIn,
  myLists,
}: {
  game: GameSummary;
  platforms: Platform[];
  initial: UserGameState | null;
  loggedIn: boolean;
  myLists: { id: string; title: string }[];
}) {
  const [state, setState] = useState<UserGameState>(initial ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const open = () => setLogOpen(true);
    window.addEventListener(OPEN_LOG_EVENT, open);
    return () => window.removeEventListener(OPEN_LOG_EVENT, open);
  }, []);

  if (!loggedIn) {
    return (
      <div className="actions">
        <div className="actions-guest">
          Registre, avalie e acompanhe seus jogos.
          <Link href={`/login?next=/games/${game.slug}`} className="btn btn-primary btn-block">
            Entrar para registrar
          </Link>
        </div>
      </div>
    );
  }

  function save(patch: LibraryEntryInput) {
    const prev = state;
    setState({ ...state, ...patch } as UserGameState);
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await saveLibraryAction(game.id, game.slug, patch);
      if (res.ok) setState(res.data);
      else {
        setState(prev);
        setError(res.error);
      }
    });
  }

  function toggleFavorite() {
    setError(null);
    start(async () => {
      const res = await toggleFavoriteAction(game.id, game.slug);
      if (res.ok) setState(res.data);
      else setError(res.error);
    });
  }

  function addToList(listId: string) {
    setListOpen(false);
    start(async () => {
      const res = await addToListAction(listId, game.id, game.slug);
      if (!res.ok) setError(res.error);
      else setNotice(res.data.added ? 'Adicionado à lista ✓' : 'Já estava nessa lista');
    });
  }

  /** Compartilhamento nativo no celular; no desktop, copia o link. */
  async function share() {
    const url = `${window.location.origin}/games/${game.slug}`;
    setError(null);
    if (navigator.share && window.matchMedia('(hover: none)').matches) {
      try {
        await navigator.share({ title: `${game.title} · Savepoint`, url });
      } catch {
        /* cancelado pelo usuário */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Link copiado ✓');
    } catch {
      setError('Não foi possível copiar o link');
    }
  }

  const hasEntry = state.status || state.rating || state.liked || state.favoriteRank;

  return (
    <div className="actions" aria-busy={pending}>
      <div className="actions-block">
        <div className="status-grid">
          {PLAY_STATUSES.map((s: PlayStatus) => (
            <button
              key={s}
              type="button"
              className={`status-btn ${state.status === s ? 'on' : ''}`}
              style={{ '--st': STATUS_COLOR[s] } as CSSProperties}
              aria-pressed={state.status === s}
              onClick={() => save({ status: state.status === s ? null : s })}
            >
              <Icon name={STATUS_ICON[s]} size={18} />
              {PLAY_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="actions-block">
        <div className="actions-row">
          <div>
            <div className="label" style={{ marginBottom: 4 }}>
              {state.rating ? 'Sua nota' : 'Avaliar'}
            </div>
            <StarInput value={state.rating} onChange={(rating) => save({ rating })} />
          </div>
          <div style={{ display: 'flex' }}>
            <button
              type="button"
              className={`icon-toggle like ${state.liked ? 'on' : ''}`}
              aria-pressed={state.liked}
              onClick={() => save({ liked: !state.liked })}
            >
              <Icon name="heart" size={24} fill={state.liked} />
              Curtir
            </button>
            <button
              type="button"
              className={`icon-toggle fav ${state.favoriteRank ? 'on' : ''}`}
              aria-pressed={Boolean(state.favoriteRank)}
              onClick={toggleFavorite}
              title="Top 4 do perfil"
            >
              <Icon name="star" size={24} fill={Boolean(state.favoriteRank)} />
              {state.favoriteRank ? `Top #${state.favoriteRank}` : 'Top 4'}
            </button>
          </div>
        </div>
      </div>

      {(state.status && state.status !== 'BACKLOG') || state.hoursPlayed ? (
        <div className="actions-block">
          <div className="actions-row">
            <label className="field" style={{ flex: 1 }}>
              <span>Plataforma</span>
              <select
                className="select"
                value={state.platformId ?? ''}
                onChange={(e) => save({ platformId: e.target.value || null })}
              >
                <option value="">—</option>
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ width: 86 }}>
              <span>Horas</span>
              <input
                className="input"
                type="number"
                min={0}
                defaultValue={state.hoursPlayed ?? ''}
                key={state.hoursPlayed ?? 'none'}
                onBlur={(e) => {
                  const v = e.target.value === '' ? null : Number(e.target.value);
                  if (v !== state.hoursPlayed) save({ hoursPlayed: v });
                }}
              />
            </label>
          </div>
        </div>
      ) : null}

      {error && <div className="actions-msg">{error}</div>}
      {notice && (
        <div className="actions-msg" style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}>
          {notice}
        </div>
      )}

      <div className="actions-block">
        <button type="button" className="btn btn-primary btn-block" onClick={() => setLogOpen(true)}>
          <Icon name="edit" size={15} /> Registrar ou escrever review
        </button>
      </div>
      <button type="button" className="actions-link" onClick={() => setListOpen((v) => !v)} aria-expanded={listOpen}>
        <Icon name="list" size={14} /> Adicionar a uma lista…
      </button>
      {listOpen && (
        <div className="actions-block" style={{ display: 'grid', gap: 4 }}>
          {myLists.map((l) => (
            <button key={l.id} type="button" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => addToList(l.id)}>
              <Icon name="list" size={14} /> {l.title}
            </button>
          ))}
          <Link href={`/lists/new?add=${game.slug}`} className="btn btn-sm" style={{ marginTop: 4 }}>
            <Icon name="plus" size={14} /> Nova lista
          </Link>
        </div>
      )}
      <button type="button" className="actions-link" onClick={share}>
        <Icon name="share" size={14} /> Compartilhar
      </button>
      {hasEntry && (
        <button
          type="button"
          className="actions-link"
          style={{ fontSize: 12, color: 'var(--faint)' }}
          onClick={() => {
            if (!confirm('Remover este jogo da sua estante? (o diário é mantido)')) return;
            start(async () => {
              const res = await removeFromLibraryAction(game.id, game.slug);
              if (res.ok) setState(EMPTY);
              else setError(res.error);
            });
          }}
        >
          Remover da estante
        </button>
      )}

      <LogDialog
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onSaved={(patch) => setState((s) => ({ ...s, ...patch }))}
        game={game}
        platforms={platforms}
        defaults={state}
      />
    </div>
  );
}
