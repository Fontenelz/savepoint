import { NextResponse, type NextRequest } from 'next/server';
import { ApiError, api } from '@/lib/api';
import { noStore } from '@/lib/auth';
import { STEAM_PATH, STEAM_STATE_COOKIE, steamCallbackUrl } from '@/lib/steam';

/**
 * Retorno do login da Steam. Confere o `state` e o endereço de retorno aqui;
 * a API confirma a assinatura com a própria Steam antes de vincular a conta.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const done = (query: string) => {
    const res = NextResponse.redirect(new URL(`${STEAM_PATH}?${query}`, req.url));
    res.cookies.delete({ name: STEAM_STATE_COOKIE, path: STEAM_PATH });
    return noStore(res);
  };

  if (sp.get('openid.mode') === 'cancel') return done('error=cancelled');

  const state = sp.get('state');
  const expected = req.cookies.get(STEAM_STATE_COOKIE)?.value;
  if (!state || !expected || state !== expected) return done('error=state');
  if (sp.get('openid.return_to') !== steamCallbackUrl(req.nextUrl.origin, state)) return done('error=state');

  const params = Object.fromEntries([...sp].filter(([key]) => key.startsWith('openid.')));
  try {
    await api('/steam/link', { method: 'POST', json: { params } });
  } catch (e) {
    return done(`error=${e instanceof ApiError && e.status === 409 ? 'taken' : 'failed'}`);
  }
  return done('linked=1');
}
