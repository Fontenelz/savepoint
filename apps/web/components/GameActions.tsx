'use client';

import {
  CLOSED_STATUSES,
  PLAY_STATUSES,
  PLAY_STATUS_LABEL,
  canRate,
  type GameSummary,
  type LibraryEntryInput,
  type Platform,
  type PlayStatus,
  type UserGameState,
  type ViewerSave,
} from '@savepoint/shared';
import Link from 'next/link';
import { useEffect, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { addToListAction, removeFromLibraryAction, replayAction, saveLibraryAction, toggleFavoriteAction } from '@/app/actions';
import { Icon, STATUS_COLOR, STATUS_ICON } from './Icon';
import { LogDialog } from './LogDialog';
import { SaveReviewDialog } from './SaveReviewDialog';
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
  suggested: null,
};

const OPEN_LOG_EVENT = 'sp:open-log';

/**
 * Abre, a partir de outro ponto da página, o diálogo do painel: a avaliação se o save atual
 * pode ser avaliado (zerado/abandonado/sem fim); senão, um novo checkpoint.
 */
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
  initialSave = null,
  endlessHint = false,
}: {
  game: GameSummary;
  platforms: Platform[];
  initial: UserGameState | null;
  loggedIn: boolean;
  myLists: { id: string; title: string }[];
  initialSave?: ViewerSave | null;
  /** Jogo provavelmente sem final definido (esportes, MMO, só online): destaca "Sem fim". */
  endlessHint?: boolean;
}) {
  const [state, setState] = useState<UserGameState>(initial ?? EMPTY);
  const [current, setCurrent] = useState<ViewerSave | null>(initialSave);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [pending, start] = useTransition();

  const rateable = canRate(current?.status ?? null);
  // Sugestão, não regra: só destaca enquanto a pessoa ainda não pode avaliar.
  const showEndlessHint = endlessHint && !canRate(state.status);
  useEffect(() => {
    const open = () => (rateable ? setReviewOpen(true) : setLogOpen(true));
    window.addEventListener(OPEN_LOG_EVENT, open);
    return () => window.removeEventListener(OPEN_LOG_EVENT, open);
  }, [rateable]);

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
      if (res.ok) {
        const { save: next, ...rest } = res.data;
        setState(rest);
        if (next !== undefined) setCurrent(next);
        // Fechou o save agora (zerou/100%/abandonou): abre "Fechar save" para nota e review.
        const closedNow = patch.status && CLOSED_STATUSES.includes(patch.status) && !CLOSED_STATUSES.includes(prev.status as PlayStatus);
        if (closedNow && next) setReviewOpen(true);
      } else {
        setState(prev);
        setError(res.error);
      }
    });
  }

  function replay() {
    if (!confirm(`Começar o Save ${(current?.number ?? 0) + 1}? O save atual fica guardado no seu diário.`)) return;
    setError(null);
    start(async () => {
      const res = await replayAction(game.id, game.slug);
      if (!res.ok) return setError(res.error);
      setCurrent(res.data);
      setState((s) => ({ ...s, status: 'PLAYING', finishedAt: null }));
      setNotice(`Save ${res.data.number} começou ✓`);
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
  // Some assim que o usuário dá a própria nota (o servidor também para de mandar).
  const suggested = state.rating ? null : state.suggested;

  return (
    <div className="actions" aria-busy={pending}>
      <div className="actions-block">
        <div className="status-grid">
          {PLAY_STATUSES.map((s: PlayStatus) => (
            <button
              key={s}
              type="button"
              className={`status-btn ${state.status === s ? 'on' : ''} ${showEndlessHint && s === 'ENDLESS' ? 'hint' : ''}`}
              title={showEndlessHint && s === 'ENDLESS' ? 'Este jogo parece não ter um final definido' : undefined}
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
              {state.rating ? 'Sua nota' : suggested ? 'Nota sugerida' : 'Avaliar'}
            </div>
            <StarInput
              value={state.rating}
              suggested={suggested?.rating}
              disabled={!canRate(state.status)}
              onChange={(rating) => save({ rating })}
            />
            {!canRate(state.status) && (
              <div className="rate-locked">
                <Icon name="lock" size={11} /> Avalie quando zerar ou abandonar
                {showEndlessHint && (
                  <button type="button" className="link-btn" onClick={() => save({ status: 'ENDLESS' })}>
                    Jogo sem fim? Marque “Sem fim” e avalie quando quiser
                  </button>
                )}
              </div>
            )}
            {suggested && (
              <div className="suggested-note">
                <span title="Calculada a partir das avaliações da loja da Steam">Steam: {suggested.steamScore}% positivas</span>
                <button type="button" onClick={() => save({ rating: suggested.rating })}>
                  Confirmar
                </button>
              </div>
            )}
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

      {current && (
        <div className="actions-block save-panel">
          <span className="save-chip" title={current.startedAt ? `Começou em ${current.startedAt}` : undefined}>
            <Icon name="save" size={12} /> Save {current.number} · {PLAY_STATUS_LABEL[current.status]}
          </span>
          <span style={{ display: 'flex', gap: 6 }}>
            {rateable && (
              <button type="button" className="btn btn-sm" onClick={() => setReviewOpen(true)}>
                <Icon name="star" size={13} /> {current.rating != null || current.review ? 'Editar avaliação' : 'Avaliar'}
              </button>
            )}
            {CLOSED_STATUSES.includes(current.status) && (
              <button type="button" className="btn btn-sm" onClick={replay}>
                <Icon name="replay" size={13} /> Rejogar
              </button>
            )}
          </span>
        </div>
      )}

      {error && <div className="actions-msg">{error}</div>}
      {notice && (
        <div className="actions-msg" style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}>
          {notice}
        </div>
      )}

      <div className="actions-block">
        <button type="button" className="btn btn-primary btn-block" onClick={() => setLogOpen(true)}>
          <Icon name="flag" size={15} /> Novo checkpoint
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
        onSaved={(patch, saved) => {
          setState((s) => ({ ...s, ...patch }));
          // O primeiro checkpoint abre o Save 1.
          setCurrent((c) =>
            c?.id === saved.id
              ? { ...c, checkpointCount: c.checkpointCount + 1 }
              : { ...saved, review: null, spoiler: false, liked: false, checkpointCount: 1 },
          );
        }}
        game={game}
        platforms={platforms}
        defaults={state}
        save={current}
      />
      {current && rateable && (
        <SaveReviewDialog
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          onSaved={(next, officialRating, liked) => {
            setCurrent(next);
            setState((s) => ({ ...s, rating: officialRating, liked: s.liked || liked }));
          }}
          game={game}
          save={current}
          officialRating={state.rating}
          suggestedRating={state.suggested?.rating}
        />
      )}
    </div>
  );
}
