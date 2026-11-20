import 'server-only';

/** Cookie da sessão (JWT da API). httpOnly: o JavaScript do navegador nunca vê o token. */
export const sessionCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};

/** Só caminhos internos ("/algo"), nunca outro site ("//site", "https://…"). */
export function safeNext(value: unknown): string | null {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export const GOOGLE_STATE_COOKIE = 'sp_google_state';
export const GOOGLE_PATH = '/auth/google';
export const googleCallbackUrl = (origin: string) => `${origin}${GOOGLE_PATH}/callback`;

/** Códigos de erro do login com Google → mensagem na tela de login. */
export const GOOGLE_ERRORS: Record<string, string> = {
  google_off: 'O login com Google não está disponível no momento.',
  google_cancelled: 'Login com Google cancelado.',
  google_state: 'O login expirou ou não foi iniciado aqui. Tente de novo.',
  google_failed: 'Não foi possível entrar com o Google. Tente de novo.',
};

/**
 * Respostas que gravam ou apagam cookies de sessão/login nunca podem ser guardadas por cache
 * compartilhado: uma cópia guardada entregaria o cookie de uma pessoa para outra.
 */
export function noStore<T extends { headers: Headers }>(res: T): T {
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
