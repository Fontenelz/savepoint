'use client';

import { MAX_FAVORITES, type GameSummary } from '@savepoint/shared';
import { useEffect, useRef, useState, useTransition } from 'react';
import { searchGamesAction, setFavoritesAction } from '@/app/actions';
import { Poster } from './bits';
import { GameCover } from './GameCover';
import { Icon } from './Icon';

/**
 * Top 4 do próprio perfil, editável ali mesmo: espaços vazios abrem a busca;
 * em "Editar", cada capa ganha trocar, mover e remover. Cada mudança é salva na hora.
 */
export function FavoritesEditor({ initial, username }: { initial: GameSummary[]; username: string }) {
  const [games, setGames] = useState(initial);
  const [editing, setEditing] = useState(false);
  /** Posição sendo preenchida/trocada no seletor (null = fechado). */
  const [slot, setSlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(next: GameSummary[]) {
    const prev = games;
    setGames(next);
    setError(null);
    start(async () => {
      const res = await setFavoritesAction(
        next.map((g) => g.id),
        username,
      );
      if (res.ok) setGames(res.data);
      else {
        setGames(prev);
        setError(res.error);
      }
    });
  }

  function pick(game: GameSummary) {
    if (slot === null) return;
    const next = [...games];
    next[slot] = game; // slot === games.length acrescenta no fim
    setSlot(null);
    save(next);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= games.length) return;
    const next = [...games];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  }

  const empty = MAX_FAVORITES - games.length;

  return (
    <section className="section">
      <div className="section-head">
        <h2>Top 4</h2>
        {games.length > 0 && (
          <button type="button" className="section-head-btn" onClick={() => setEditing((v) => !v)} aria-pressed={editing}>
            {editing ? 'Concluir' : 'Editar'}
          </button>
        )}
      </div>

      <div className={`favorites ${editing ? 'is-editing' : ''}`} aria-busy={pending}>
        {games.map((g, i) => (
          <div key={g.id} className="fav-item">
            <Poster game={g} tip={!editing} />
            {editing && (
              <div className="fav-tools">
                <button type="button" className="fav-swap" onClick={() => setSlot(i)}>
                  <Icon name="replay" size={16} />
                  Trocar
                </button>
                <div className="fav-tools-row">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Mover ${g.title} para a esquerda`}>
                    <Icon name="up" size={14} className="rot-left" />
                  </button>
                  <button
                    type="button"
                    onClick={() => save(games.filter((x) => x.id !== g.id))}
                    aria-label={`Remover ${g.title} do Top 4`}
                  >
                    <Icon name="x" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === games.length - 1}
                    aria-label={`Mover ${g.title} para a direita`}
                  >
                    <Icon name="up" size={14} className="rot-right" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <button key={i} type="button" className="fav-slot fav-add" onClick={() => setSlot(games.length)}>
            <Icon name="plus" size={20} />
            Adicionar
          </button>
        ))}
      </div>

      {error && <p className="fav-error">{error}</p>}

      <FavoritePicker
        open={slot !== null}
        replacing={slot !== null ? (games[slot] ?? null) : null}
        exclude={games.map((g) => g.id)}
        onPick={pick}
        onClose={() => setSlot(null)}
      />
    </section>
  );
}

function FavoritePicker({
  open,
  replacing,
  exclude,
  onPick,
  onClose,
}: {
  open: boolean;
  replacing: GameSummary | null;
  exclude: string[];
  onPick: (g: GameSummary) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GameSummary[]>([]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setQ('');
      setResults([]);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!q.trim()) return setResults([]);
    // Resposta de uma busca antiga que chegue depois da atual é descartada.
    let stale = false;
    timer.current = setTimeout(async () => {
      const found = await searchGamesAction(q);
      if (!stale) setResults(found);
    }, 250);
    return () => {
      stale = true;
      clearTimeout(timer.current);
    };
  }, [q]);

  const shown = results.filter((g) => !exclude.includes(g.id));

  return (
    <dialog ref={ref} className="dialog dialog-sm" onClose={onClose} aria-labelledby="fav-title">
      <div className="dialog-head">
        <h2 id="fav-title">{replacing ? `Trocar ${replacing.title}` : 'Adicionar ao Top 4'}</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar">
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="fav-picker">
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar no catálogo…"
          aria-label="Buscar jogo"
          autoFocus
        />
        <div className="fav-results" role="listbox" aria-label="Resultados">
          {shown.map((g) => (
            <button key={g.id} type="button" role="option" aria-selected={false} onClick={() => onPick(g)}>
              <GameCover game={g} />
              <span>
                <strong>{g.title}</strong> <span className="muted">{g.releaseYear}</span>
              </span>
            </button>
          ))}
          {q.trim() && results.length > 0 && shown.length === 0 && <p className="muted">Esses jogos já estão no seu Top 4.</p>}
          {!q.trim() && <p className="muted">Digite o nome de um jogo.</p>}
        </div>
      </div>
    </dialog>
  );
}
