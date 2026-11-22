'use client';

import type { GameSummary, Platform, UserGameState } from '@savepoint/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { getLogContextAction, searchGamesAction } from '@/app/actions';
import { GameCover } from './GameCover';
import { Icon } from './Icon';
import { LogDialog } from './LogDialog';

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

type Ctx = { game: GameSummary; platforms: Platform[]; state: UserGameState };

/**
 * Botão "+ Registrar" do cabeçalho: escolhe o jogo numa busca e abre o mesmo formulário do diário
 * da página do jogo, sem sair da página atual.
 */
export function QuickLog() {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GameSummary[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [saved, setSaved] = useState<GameSummary | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (searching && !d.open) {
      setQ('');
      setResults([]);
      setError(null);
      d.showModal();
    }
    if (!searching && d.open) d.close();
  }, [searching]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!q.trim()) return setResults([]);
    timer.current = setTimeout(async () => setResults(await searchGamesAction(q)), 250);
    return () => clearTimeout(timer.current);
  }, [q]);

  // Aviso de "registrado" some sozinho.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 6000);
    return () => clearTimeout(t);
  }, [saved]);

  async function pick(game: GameSummary) {
    setLoadingId(game.id);
    setError(null);
    const res = await getLogContextAction(game.slug);
    setLoadingId(null);
    if (!res.ok) return setError(res.error);
    setSearching(false);
    setCtx({ ...res.data, state: res.data.state ?? EMPTY });
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-primary btn-sm quick-log-btn"
        onClick={() => setSearching(true)}
        aria-label="Registrar no diário"
        title="Registrar no diário"
      >
        <Icon name="plus" size={15} />
        <span className="hide-sm">Registrar</span>
      </button>

      <dialog ref={ref} className="dialog dialog-sm" onClose={() => setSearching(false)} aria-labelledby="quick-log-title">
        <div className="dialog-head">
          <h2 id="quick-log-title">O que você jogou?</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSearching(false)} aria-label="Fechar">
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
          {error && <div className="form-error">{error}</div>}
          <div className="fav-results quick-log-results" role="listbox" aria-label="Resultados">
            {results.map((g) => (
              <button
                key={g.id}
                type="button"
                role="option"
                aria-selected={false}
                disabled={loadingId !== null}
                onClick={() => pick(g)}
              >
                <GameCover game={g} />
                <span>
                  <strong>{g.title}</strong> <span className="muted">{g.releaseYear}</span>
                </span>
                {loadingId === g.id && <span className="spinner" aria-label="Carregando" />}
              </button>
            ))}
            {!q.trim() && <p className="muted">Digite o nome de um jogo.</p>}
            {q.trim() && results.length === 0 && (
              <p className="muted">
                Não achou? <Link href="/games/new" onClick={() => setSearching(false)}>Cadastre o jogo</Link>.
              </p>
            )}
          </div>
        </div>
      </dialog>

      {ctx && (
        <LogDialog
          key={ctx.game.id}
          open
          onClose={() => setCtx(null)}
          onSaved={() => {
            setSaved(ctx.game);
            router.refresh(); // atualiza estante/diário da página atual
          }}
          game={ctx.game}
          platforms={ctx.platforms}
          defaults={ctx.state}
        />
      )}

      {saved && (
        <div className="toast" role="status">
          <Icon name="check" size={15} /> <span>{saved.title} registrado no diário.</span>{' '}
          <Link href={`/games/${saved.slug}`} onClick={() => setSaved(null)}>
            Ver jogo
          </Link>
        </div>
      )}
    </>
  );
}
