import type { AuthResponse } from '@savepoint/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { ApiError, TOKEN_COOKIE, api } from '@/lib/api';
import { STEAM_LOGIN_PATH, STEAM_LOGIN_STATE_COOKIE, noStore, safeNext, sessionCookie, steamLoginCallbackUrl } from '@/lib/auth';

/**
 * Retorno do login da Steam. Confere o `state` e o endereço de retorno aqui; a API confirma a
 * assinatura com a própria Steam e só devolve sessão para conta que já conectou essa Steam.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const go = (path: string, token?: string) => {
    const res = NextResponse.redirect(new URL(path, req.url));
    res.cookies.delete({ name: STEAM_LOGIN_STATE_COOKIE, path: STEAM_LOGIN_PATH });
    if (token) res.cookies.set(TOKEN_COOKIE, token, sessionCookie);
    return noStore(res);
  };

  if (sp.get('openid.mode') === 'cancel') return go('/login?error=steam_cancelled');

  let saved: { state?: string; next?: string | null } = {};
  try {
    saved = JSON.parse(req.cookies.get(STEAM_LOGIN_STATE_COOKIE)?.value ?? '{}');
  } catch {
    // cookie corrompido: cai na checagem abaixo
  }
  const state = sp.get('state');
  if (!state || !saved.state || state !== saved.state) return go('/login?error=steam_state');
  if (sp.get('openid.return_to') !== steamLoginCallbackUrl(req.nextUrl.origin, state)) return go('/login?error=steam_state');

  const params = Object.fromEntries([...sp].filter(([key]) => key.startsWith('openid.')));
  try {
    const auth = await api<AuthResponse>('/steam/login', { method: 'POST', json: { params } });
    return go(safeNext(saved.next) ?? '/', auth.token);
  } catch (e) {
    return go(`/login?error=${e instanceof ApiError && e.status === 404 ? 'steam_unlinked' : 'steam_failed'}`);
  }
}
