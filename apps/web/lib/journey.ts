import { CLOSED_STATUSES, PLAY_STATUS_LABEL, PLAY_STATUS_VERB, type CheckpointView } from '@savepoint/shared';

/** Rótulo curto do checkpoint no diário: "Começou o Save 2", "Sessão", "Zerado". */
export function checkpointLabel(cp: CheckpointView) {
  if (cp.kind === 'STARTED') return cp.save.number > 1 ? `Começou o Save ${cp.save.number}` : 'Começou';
  if (cp.kind === 'CLOSED') return CLOSED_STATUSES.includes(cp.save.status) ? PLAY_STATUS_LABEL[cp.save.status] : 'Fechou o save';
  return 'Sessão';
}

/** Verbo do feed: "ana zerou Celeste", "bruno começou o Save 2 de Hades", "carol registrou um checkpoint em". */
export function checkpointVerb(cp: CheckpointView) {
  if (cp.kind === 'STARTED') return cp.save.number > 1 ? `começou o Save ${cp.save.number} de` : 'começou a jogar';
  if (cp.kind === 'CLOSED') return CLOSED_STATUSES.includes(cp.save.status) ? PLAY_STATUS_VERB[cp.save.status] : 'fechou o save de';
  return 'registrou um checkpoint em';
}

/** Nota que aparece junto do checkpoint: só no fechamento (a avaliação do save). */
export function checkpointRating(cp: CheckpointView) {
  return cp.kind === 'CLOSED' ? cp.save.rating : null;
}
