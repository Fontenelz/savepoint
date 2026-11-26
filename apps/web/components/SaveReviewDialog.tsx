'use client';

import { PLAY_STATUS_LABEL, type GameSummary, type ViewerSave } from '@savepoint/shared';
import { useEffect, useRef, useState, useTransition } from 'react';
import { reviewSaveAction } from '@/app/actions';
import { GameCover } from './GameCover';
import { Icon } from './Icon';
import { Stars } from './bits';
import { StarInput } from './StarInput';

/**
 * Modal "Fechar save": nota + review do save (zerado, 100%, abandonado ou "Sem fim").
 * Se a pessoa já tem uma nota oficial diferente, ela escolhe se a nota deste save a substitui.
 */
export function SaveReviewDialog({
  open,
  onClose,
  onSaved,
  game,
  save,
  officialRating,
  suggestedRating,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (save: ViewerSave, officialRating: number | null, liked: boolean) => void;
  game: GameSummary;
  save: ViewerSave;
  officialRating: number | null;
  suggestedRating?: number | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [rating, setRating] = useState<number | null>(save.rating ?? officialRating ?? suggestedRating ?? null);
  const [liked, setLiked] = useState(save.liked);
  const [official, setOfficial] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setRating(save.rating ?? officialRating ?? suggestedRating ?? null);
      setLiked(save.liked);
      setOfficial(true);
      setError(null);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open, save.rating, save.liked, officialRating, suggestedRating]);

  // Só pergunta quando há uma nota oficial e ela é diferente da deste save.
  const askOfficial = officialRating != null && rating != null && rating !== officialRating;

  function submit(form: FormData) {
    const input = {
      rating,
      review: String(form.get('review') ?? '').trim() || null,
      spoiler: form.get('spoiler') === 'on',
      liked,
      official: askOfficial ? official : true,
    };
    setError(null);
    start(async () => {
      const res = await reviewSaveAction(save.id, input, game.slug);
      if (!res.ok) return setError(res.error);
      const nextOfficial = rating != null && (input.official || officialRating == null) ? rating : officialRating;
      onSaved(res.data, nextOfficial, liked);
      onClose();
    });
  }

  const title = save.status === 'ENDLESS' ? 'Avaliar' : save.rating != null || save.review ? 'Editar avaliação' : 'Fechar save';

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="review-title">
      <form action={submit}>
        <div className="dialog-head">
          <h2 id="review-title">{title}</h2>
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
                <Icon name="save" size={12} /> Save {save.number} · {PLAY_STATUS_LABEL[save.status]}
              </span>
            </div>
            <label className="field">
              <span>Review</span>
              <textarea
                className="textarea"
                name="review"
                defaultValue={save.review ?? ''}
                key={save.id + (save.review ?? '')}
                placeholder="O que você achou da jornada? (opcional)"
                maxLength={8000}
              />
            </label>
            <label className="check">
              <input type="checkbox" name="spoiler" defaultChecked={save.spoiler} /> Contém spoilers
            </label>
            {askOfficial && (
              <label className="check">
                <input type="checkbox" checked={official} onChange={(e) => setOfficial(e.target.checked)} />
                <span>
                  Usar <Stars rating={rating} /> como sua nota oficial (hoje: <Stars rating={officialRating} />)
                </span>
              </label>
            )}
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
