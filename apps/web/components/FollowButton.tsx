'use client';

import { useState, useTransition } from 'react';
import { followAction } from '@/app/actions';

export function FollowButton({ username, initial }: { username: string; initial: boolean }) {
  const [following, setFollowing] = useState(initial);
  const [hover, setHover] = useState(false);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className={`btn ${following ? '' : 'btn-primary'}`}
      disabled={pending}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => {
        const next = !following;
        setFollowing(next);
        start(async () => {
          const res = await followAction(username, next);
          if (!res.ok) setFollowing(!next);
        });
      }}
    >
      {following ? (hover ? 'Deixar de seguir' : 'Seguindo ✓') : 'Seguir'}
    </button>
  );
}
