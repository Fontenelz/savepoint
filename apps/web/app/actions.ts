'use server';

import {
  createGameSchema,
  loginSchema,
  registerSchema,
  type AuthResponse,
  type ExternalGameResult,
  type GameSummary,
  type LibraryEntryInput,
  type ListInput,
  type LogEntryInput,
  type UserGameState,
} from '@savepoint/shared';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { TOKEN_COOKIE, api, errorMessage } from '@/lib/api';

export type FormState = { error: string | null };
type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

async function startSession(auth: AuthResponse) {
  (await cookies()).set(TOKEN_COOKIE, auth.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/') && !next.startsWith('//') ? next : null;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ login: form.get('login'), password: form.get('password') });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const res = await run(() => api<AuthResponse>('/auth/login', { method: 'POST', json: parsed.data }));
  if (!res.ok) return { error: res.error };
  await startSession(res.data);
  redirect(safeNext(form.get('next')) ?? '/');
}

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const res = await run(() => api<AuthResponse>('/auth/register', { method: 'POST', json: parsed.data }));
  if (!res.ok) return { error: res.error };
  await startSession(res.data);
  redirect(`/u/${res.data.user.username}`);
}

export async function logoutAction() {
  (await cookies()).delete(TOKEN_COOKIE);
  redirect('/');
}

// ─── Estante / diário ────────────────────────────────────────────────────────

export async function saveLibraryAction(gameId: string, slug: string, patch: LibraryEntryInput) {
  const res = await run(() => api<UserGameState>(`/library/${gameId}`, { method: 'PUT', json: patch }));
  revalidatePath(`/games/${slug}`);
  return res;
}

export async function removeFromLibraryAction(gameId: string, slug: string) {
  const res = await run(() => api(`/library/${gameId}`, { method: 'DELETE' }));
  revalidatePath(`/games/${slug}`);
  return res;
}

export async function toggleFavoriteAction(gameId: string, slug: string) {
  const res = await run(() => api<UserGameState>(`/library/${gameId}/favorite`, { method: 'POST' }));
  revalidatePath(`/games/${slug}`);
  return res;
}

export async function createLogAction(input: LogEntryInput, slug: string) {
  const res = await run(() => api<{ id: string }>('/logs', { method: 'POST', json: input }));
  revalidatePath(`/games/${slug}`);
  return res;
}

export async function deleteLogAction(id: string, path: string) {
  const res = await run(() => api(`/logs/${id}`, { method: 'DELETE' }));
  revalidatePath(path);
  return res;
}

export async function toggleReviewLikeAction(logId: string) {
  return run(() => api<{ liked: boolean; likeCount: number }>(`/logs/${logId}/like`, { method: 'POST' }));
}

// ─── Social ──────────────────────────────────────────────────────────────────

export async function followAction(username: string, follow: boolean) {
  const res = await run(() => api(`/users/${username}/follow`, { method: follow ? 'POST' : 'DELETE' }));
  revalidatePath(`/u/${username}`, 'layout');
  return res;
}

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const res = await run(() =>
    api<{ username: string }>('/me', {
      method: 'PATCH',
      json: { displayName: form.get('displayName'), bio: form.get('bio') || null },
    }),
  );
  if (!res.ok) return { error: res.error };
  revalidatePath(`/u/${res.data.username}`, 'layout');
  redirect(`/u/${res.data.username}`);
}

// ─── Listas ──────────────────────────────────────────────────────────────────

export async function searchGamesAction(q: string): Promise<GameSummary[]> {
  if (q.trim().length < 1) return [];
  const res = await run(() => api<GameSummary[]>(`/games/search?q=${encodeURIComponent(q)}`));
  return res.ok ? res.data : [];
}

export async function saveListAction(id: string | null, input: ListInput) {
  const res = await run(() =>
    api<{ id: string }>(id ? `/lists/${id}` : '/lists', { method: id ? 'PUT' : 'POST', json: input }),
  );
  if (!res.ok) return res;
  revalidatePath(`/lists/${res.data.id}`);
  redirect(`/lists/${res.data.id}`);
}

export async function deleteListAction(id: string, username: string) {
  const res = await run(() => api(`/lists/${id}`, { method: 'DELETE' }));
  if (!res.ok) return res;
  redirect(`/u/${username}/lists`);
}

export async function addToListAction(listId: string, gameId: string, slug: string) {
  const res = await run(() =>
    api<{ added: boolean }>(`/lists/${listId}/items`, { method: 'POST', json: { gameId } }),
  );
  revalidatePath(`/games/${slug}`);
  return res;
}

// ─── Catálogo ────────────────────────────────────────────────────────────────

export async function createGameAction(_: FormState, form: FormData): Promise<FormState> {
  const num = (k: string) => (form.get(k) ? Number(form.get(k)) : null);
  const str = (k: string) => (String(form.get(k) ?? '').trim() || null);
  const parsed = createGameSchema.safeParse({
    title: form.get('title'),
    releaseYear: num('releaseYear'),
    developer: str('developer'),
    publisher: str('publisher'),
    summary: str('summary'),
    avgHours: num('avgHours'),
    coverUrl: str('coverUrl'),
    genreIds: form.getAll('genreIds'),
    platformIds: form.getAll('platformIds'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const res = await run(() => api<GameSummary>('/games', { method: 'POST', json: parsed.data }));
  if (!res.ok) return { error: res.error };
  // Busca capa/banner automaticamente; se falhar, o jogo fica com a capa gerada.
  await run(() => api(`/catalog/games/${res.data.slug}/artwork`, { method: 'POST' }));
  redirect(`/games/${res.data.slug}`);
}

export async function searchExternalAction(q: string) {
  return run(() => api<ExternalGameResult[]>(`/catalog/search?q=${encodeURIComponent(q)}`));
}

export async function importExternalAction(externalId: string) {
  const res = await run(() => api<{ slug: string }>('/catalog/import', { method: 'POST', json: { externalId } }));
  if (!res.ok) return res;
  redirect(`/games/${res.data.slug}`);
}
