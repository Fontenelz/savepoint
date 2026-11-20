import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { TOKEN_COOKIE } from '@/lib/api';
import { STEAM_PATH, STEAM_STATE_COOKIE, steamCallbackUrl } from '@/lib/steam';

/** Início da conexão: manda o usuário para o login da Steam (OpenID 2.0). */
export async function GET(req: NextRequest) {
  if (!req.cookies.get(TOKEN_COOKIE)) {
    return NextResponse.redirect(new URL(`/login?next=${STEAM_PATH}`, req.url));
  }

  const origin = req.nextUrl.origin;
  const state = randomBytes(16).toString('hex');
  const identifierSelect = 'http://specs.openid.net/auth/2.0/identifier_select';
  const url = new URL('https://steamcommunity.com/openid/login');
  url.search = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': steamCallbackUrl(origin, state),
    'openid.realm': origin,
    'openid.identity': identifierSelect,
    'openid.claimed_id': identifierSelect,
  }).toString();

  const res = NextResponse.redirect(url);
  res.cookies.set(STEAM_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax', // o retorno da Steam é uma navegação de primeiro nível (GET): o cookie vai junto
    secure: process.env.NODE_ENV === 'production',
    path: STEAM_PATH,
    maxAge: 10 * 60,
  });
  return res;
}
