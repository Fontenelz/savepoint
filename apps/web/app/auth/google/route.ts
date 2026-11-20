import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { api } from '@/lib/api';
import { GOOGLE_PATH, GOOGLE_STATE_COOKIE, googleCallbackUrl, noStore, safeNext, sessionCookie } from '@/lib/auth';

/** Início do login com Google: manda o usuário para a tela de escolha de conta. */
export async function GET(req: NextRequest) {
  const config = await api<{ enabled: boolean; clientId: string | null }>('/auth/google/config').catch(() => null);
  if (!config?.enabled || !config.clientId) {
    return noStore(NextResponse.redirect(new URL('/login?error=google_off', req.url)));
  }

  const state = randomBytes(16).toString('hex');
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: googleCallbackUrl(req.nextUrl.origin),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  }).toString();

  const res = NextResponse.redirect(url);
  // state protege contra login forçado; next guarda para onde voltar depois.
  res.cookies.set(GOOGLE_STATE_COOKIE, JSON.stringify({ state, next }), {
    ...sessionCookie,
    path: GOOGLE_PATH,
    maxAge: 10 * 60,
  });
  return noStore(res);
}
