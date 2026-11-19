'use client';

import type { GameSummary } from '@savepoint/shared';
import { useEffect, useRef, useState, useTransition } from 'react';
import { deleteListAction, saveListAction, searchGamesAction } from '@/app/actions';
import { GameCover } from './GameCover';
import { Icon } from './Icon';

/** Editor de listas: busca jogos no catálogo local, reordena e salva. */
export function ListBuilder({
  listId,
  owner,
  initial,
}: {
  listId: string | null;
  owner: string;
  initial: { title: string; description: string; ranked: boolean; games: GameSummary[] };
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [ranked, setRanked] = useState(initial.ranked);
  const [games, setGames] = useState(initial.games);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GameSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Busca com debounce de 250 ms
  useEffect(() => {
    clearTimeout(timer.current);
    if (!q.trim()) return setResults([]);
    timer.current = setTimeout(async () => setResults(await searchGamesAction(q)), 250);
    return () => clearTimeout(timer.current);
  }, [q]);

  const add = (g: GameSummary) => {
    if (!games.some((x) => x.id === g.id)) setGames([...games, g]);
    setQ('');
    setResults([]);
  };

  const move = (i: number, d: -1 | 1) => {
    const next = [...games];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setGames(next);
  };

  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startSave(async () => {
          const res = await saveListAction(listId, {
            title,
            description: description || null,
            ranked,
            gameIds: games.map((g) => g.id),
          });
          if (res && !res.ok) setError(res.error);
        });
      }}
    >
      {error && <div className="form-error full">{error}</div>}
      <label className="field full">
        <span>Nome da lista</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={80} placeholder="Ex.: Jogos pra zerar no fim de semana" />
      </label>
      <label className="field full">
        <span>Descrição</span>
        <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} style={{ minHeight: 80 }} />
      </label>
      <label className="check full">
        <input type="checkbox" checked={ranked} onChange={(e) => setRanked(e.target.checked)} />
        Lista ranqueada (mostra a posição de cada jogo)
      </label>

      <div className="field full search-pop">
        <span>Adicionar jogos</span>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no catálogo…" aria-label="Buscar jogo para adicionar" />
        {results.length > 0 && (
          <div className="search-results" role="listbox">
            {results.map((g) => (
              <button key={g.id} type="button" onClick={() => add(g)} role="option" aria-selected={false}>
                <GameCover game={g} />
                <span>
                  <strong>{g.title}</strong> <span className="muted">{g.releaseYear}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="builder-list full">
        {games.length === 0 && <div className="empty">Nenhum jogo ainda. Busque acima para adicionar.</div>}
        {games.map((g, i) => (
          <div key={g.id} className="builder-item">
            <span className="rank">{ranked ? i + 1 : '•'}</span>
            <GameCover game={g} />
            <div>
              <strong>{g.title}</strong> <span className="muted">{g.releaseYear}</span>
            </div>
            <div className="ctrl">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, -1)} aria-label="Subir">
                <Icon name="up" size={14} />
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, 1)} aria-label="Descer">
                <Icon name="down" size={14} />
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setGames(games.filter((x) => x.id !== g.id))} aria-label="Remover">
                <Icon name="x" size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="full" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <button className="btn btn-primary btn-lg" disabled={saving}>
          {saving ? 'Salvando…' : listId ? 'Salvar alterações' : 'Criar lista'}
        </button>
        {listId && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ color: 'var(--heart)' }}
            onClick={() => {
              if (!confirm('Excluir esta lista?')) return;
              startSave(async () => {
                const res = await deleteListAction(listId, owner);
                if (res && !res.ok) setError(res.error);
              });
            }}
          >
            <Icon name="trash" size={14} /> Excluir lista
          </button>
        )}
      </div>
    </form>
  );
}
