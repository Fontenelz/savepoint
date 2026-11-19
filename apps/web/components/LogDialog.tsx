'use client';

import type { GameSummary, Platform, UserGameState } from '@savepoint/shared';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createLogAction } from '@/app/actions';
import { today } from '@/lib/format';
import { GameCover } from './GameCover';
import { Icon } from './Icon';
import { StarInput } from './StarInput';

/** Modal "Registrar no diário" — o coração do app (equivalente ao "Log" do Letterboxd). */
export function LogDialog({
  open,
  onClose,
  onSaved,
  game,
  platforms,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (patch: Partial<UserGameState>) => void;
  game: GameSummary;
  platforms: Platform[];
  defaults: UserGameState;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [rating, setRating] = useState<number | null>(defaults.rating);
  const [liked, setLiked] = useState(defaults.liked);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setRating(defaults.rating);
      setLiked(defaults.liked);
      setError(null);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open, defaults.rating, defaults.liked]);

  function submit(form: FormData) {
    const hours = form.get('hours');
    const finished = form.get('finished') === 'on';
    const platformId = String(form.get('platformId') || '') || null;
    const input = {
      gameId: game.id,
      playedOn: String(form.get('playedOn')),
      platformId,
      hours: hours ? Number(hours) : null,
      finished,
      replay: form.get('replay') === 'on',
      rating,
      liked,
      review: String(form.get('review') ?? '').trim() || null,
      spoiler: form.get('spoiler') === 'on',
    };
    setError(null);
    start(async () => {
      const res = await createLogAction(input, game.slug);
      if (!res.ok) return setError(res.error);
      onSaved({
        ...(rating ? { rating } : {}),
        ...(liked ? { liked } : {}),
        ...(platformId ? { platformId } : {}),
        ...(input.hours != null ? { hoursPlayed: input.hours } : {}),
        status: finished
          ? defaults.status === 'MASTERED'
            ? 'MASTERED'
            : 'COMPLETED'
          : !defaults.status || defaults.status === 'BACKLOG'
            ? 'PLAYING'
            : defaults.status,
      });
      onClose();
    });
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="log-title">
      <form action={submit}>
        <div className="dialog-head">
          <h2 id="log-title">Registrar no diário</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="dialog-body">
          <div className="cover-col">
            <GameCover game={game} />
          </div>
          <div className="dialog-fields">
            <div>
              <h3 style={{ fontSize: 22 }}>{game.title}</h3>
              {game.releaseYear && <span className="muted">{game.releaseYear}</span>}
            </div>
            <div className="inline">
              <label className="field">
                <span>Jogado em</span>
                <input className="input" type="date" name="playedOn" defaultValue={today()} max={today()} required />
              </label>
              <label className="field" style={{ minWidth: 150 }}>
                <span>Plataforma</span>
                <select className="select" name="platformId" defaultValue={defaults.platformId ?? ''}>
                  <option value="">—</option>
                  {platforms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" style={{ width: 100 }}>
                <span>Horas (total)</span>
                <input className="input" type="number" name="hours" min={0} step="0.5" defaultValue={defaults.hoursPlayed ?? ''} />
              </label>
            </div>
            <div className="inline">
              <label className="check">
                <input type="checkbox" name="finished" defaultChecked={defaults.status === 'COMPLETED'} /> Zerei
              </label>
              <label className="check">
                <input type="checkbox" name="replay" /> Estou rejogando
              </label>
            </div>
            <label className="field">
              <span>Review</span>
              <textarea className="textarea" name="review" placeholder="Escreva o que achou… (opcional)" maxLength={8000} />
            </label>
            <label className="check">
              <input type="checkbox" name="spoiler" /> Contém spoilers
            </label>
          </div>
        </div>
        {error && (
          <div className="form-error" style={{ margin: '0 18px 14px' }}>
            {error}
          </div>
        )}
        <div className="dialog-foot">
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <StarInput value={rating} onChange={setRating} size={24} />
            <button type="button" className={`icon-toggle like ${liked ? 'on' : ''}`} onClick={() => setLiked(!liked)} aria-pressed={liked}>
              <Icon name="heart" size={22} fill={liked} />
            </button>
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
