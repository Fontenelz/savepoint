import 'server-only';
import type { Viewer } from '@savepoint/shared';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { TOKEN_COOKIE, api } from './api';

/** Usuário logado (memoizado por requisição). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  try {
    return await api<Viewer>('/auth/me');
  } catch {
    return null;
  }
});
