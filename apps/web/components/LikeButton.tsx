'use client';

import { useState, useTransition } from 'react';
import { toggleReviewLikeAction } from '@/app/actions';
import { Icon } from './Icon';

export function LikeButton({
  logId,
  initialLiked,
  initialCount,
  enabled,
}: {
  logId: string;
  initialLiked: boolean;
  initialCount: number;
  enabled: boolean;
}) {
  const [state, setState] = useState({ liked: initialLiked, count: initialCount });
  const [pending, start] = useTransition();

  const label = `${state.count} ${state.count === 1 ? 'curtida' : 'curtidas'}`;
  if (!enabled) {
    return (
      <span className="like-btn">
        <Icon name="heart" size={13} /> {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`like-btn ${state.liked ? 'on' : ''}`}
      disabled={pending}
      aria-pressed={state.liked}
      onClick={() => {
        const prev = state;
        // Atualização otimista: a UI responde na hora, o servidor confirma depois.
        setState({ liked: !prev.liked, count: prev.count + (prev.liked ? -1 : 1) });
        start(async () => {
          const res = await toggleReviewLikeAction(logId);
          if (res.ok) setState({ liked: res.data.liked, count: res.data.likeCount });
          else setState(prev);
        });
      }}
    >
      <Icon name="heart" size={13} fill={state.liked} /> {state.liked ? 'Curtiu' : 'Curtir'} · {label}
    </button>
  );
}
