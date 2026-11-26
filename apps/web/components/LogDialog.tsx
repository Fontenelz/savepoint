'use client';

import {
  PLAY_STATUS_LABEL,
  type GameSummary,
  type Platform,
  type SaveSummary,
  type UserGameState,
  type ViewerSave,
} from '@savepoint/shared';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createLogAction } from '@/app/actions';
import { today } from '@/lib/format';
import { GameCover } from './GameCover';
import { Icon } from './Icon';

/**
 * Modal "Novo checkpoint": registra uma sessão/anotação no save atual (o diário de jornada).
 * Não tem nota nem review: a avaliação é do save, quando ele fecha (zerou/abandonou).
 */
export function LogDialog({
  open,
  onClose,
  onSaved,
  game,
  platforms,
  defaults,
  save = null,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (patch: Partial<UserGameState>, save: SaveSummary) => void;
  game: GameSummary;
  platforms: Platform[];
  defaults: UserGameState;
  save?: ViewerSave | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setError(null);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  function submit(form: FormData) {
    const hours = form.get('hours');
    const platformId = String(form.get('platformId') || '') || null;
    const input = {
      gameId: game.id,
      playedOn: String(form.get('playedOn')),
      platformId,
      hours: hours ? Number(hours) : null,
      note: String(form.get('note') ?? '').trim() || null,
      spoiler: form.get('spoiler') === 'on',
      isPublic: form.get('isPublic') === 'on',
    };
    setError(null);
    start(async () => {
      const res = await createLogAction(input, game.slug);
      if (!res.ok) return setError(res.error);
      onSaved({
        ...(platformId ? { platformId } : {}),
        ...(input.hours != null ? { hoursPlayed: input.hours } : {}),
        // Sem status (ou só "Quero jogar"), registrar abre o save: passa a "Jogando".
        status: !defaults.status || defaults.status === 'BACKLOG' ? 'PLAYING' : defaults.status,
      }, res.data.save);
      onClose();
    });
  }

  const saveLabel = save
    ? `Save ${save.number} · ${PLAY_STATUS_LABEL[save.status]}`
    : 'Começa o Save 1 deste jogo';

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="log-title">
      <form action={submit}>
        <div className="dialog-head">
          <h2 id="log-title">Novo checkpoint</h2>
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
              <span className="save-chip">
                <Icon name="save" size={12} /> {saveLabel}
              </span>
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
            <label className="field">
              <span>Anotação</span>
              <textarea
                className="textarea"
                name="note"
                placeholder="Como foi a sessão? Onde parou, o que achou até aqui… (opcional)"
                maxLength={4000}
              />
            </label>
            <div className="inline">
              <label className="check">
                <input type="checkbox" name="spoiler" /> Contém spoilers
              </label>
              <label className="check" title="Checkpoints privados só aparecem para você">
                <input type="checkbox" name="isPublic" defaultChecked /> Público
              </label>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              A nota e a review ficam para quando você zerar ou abandonar o jogo.
            </p>
          </div>
        </div>
        {error && (
          <div className="form-error" style={{ margin: '0 18px 14px' }}>
            {error}
          </div>
        )}
        <div className="dialog-foot" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Salvando…' : 'Salvar checkpoint'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
