import type { GoogleAuthResponse } from '@savepoint/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { TOKEN_COOKIE, api } from '@/lib/api';
import { GOOGLE_PATH, GOOGLE_STATE_COOKIE, googleCallbackUrl, safeNext, sessionCookie } from '@/lib/auth';

/**
 * Retorno do Google. Confere o state aqui; a API troca o código pelos dados da conta
 * (com o segredo do cliente) e devolve a sessão, gravada no mesmo cookie do login normal.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const go = (path: string, token?: string) => {
    const res = NextResponse.redirect(new URL(path, req.url));
    res.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: GOOGLE_PATH });
    if (token) res.cookies.set(TOKEN_COOKIE, token, sessionCookie);
    return res;
  };

  if (sp.get('error')) return go('/login?error=google_cancelled');

  let saved: { state?: string; next?: string | null } = {};
  try {
    saved = JSON.parse(req.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? '{}');
  } catch {
    // cookie corrompido: cai na checagem abaixo
  }
  const code = sp.get('code');
  if (!code || !saved.state || sp.get('state') !== saved.state) return go('/login?error=google_state');

  try {
    const auth = await api<GoogleAuthResponse>('/auth/google', {
      method: 'POST',
      json: { code, redirectUri: googleCallbackUrl(req.nextUrl.origin) },
    });
    // Conta nova vai para o perfil (como no cadastro normal); quem já tinha conta volta para onde estava.
    const target = auth.created ? `/u/${auth.user.username}` : (safeNext(saved.next) ?? '/');
    return go(target, auth.token);
  } catch {
    return go('/login?error=google_failed');
  }
}
