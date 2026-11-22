import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { api } from '@/lib/api';
import { STEAM_LOGIN_PATH, STEAM_LOGIN_STATE_COOKIE, noStore, safeNext, sessionCookie, steamLoginCallbackUrl } from '@/lib/auth';

/**
 * Início do "Entrar com a Steam": manda para o login da Steam (OpenID 2.0), como na conexão da
 * conta em Configurações → Steam, mas voltando para cá. Só entra quem já conectou a Steam.
 */
export async function GET(req: NextRequest) {
  const status = await api<{ enabled: boolean }>('/steam/status').catch(() => null);
  if (!status?.enabled) return noStore(NextResponse.redirect(new URL('/login?error=steam_off', req.url)));

  const origin = req.nextUrl.origin;
  const state = randomBytes(16).toString('hex');
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  const identifierSelect = 'http://specs.openid.net/auth/2.0/identifier_select';
  const url = new URL('https://steamcommunity.com/openid/login');
  url.search = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': steamLoginCallbackUrl(origin, state),
    'openid.realm': origin,
    'openid.identity': identifierSelect,
    'openid.claimed_id': identifierSelect,
  }).toString();

  const res = NextResponse.redirect(url);
  // state protege contra login forçado; next guarda para onde voltar depois.
  res.cookies.set(STEAM_LOGIN_STATE_COOKIE, JSON.stringify({ state, next }), {
    ...sessionCookie,
    path: STEAM_LOGIN_PATH,
    maxAge: 10 * 60,
  });
  return noStore(res);
}
