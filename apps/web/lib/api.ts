import 'server-only';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:3333/api';
export const TOKEN_COOKIE = 'sp_token';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type ApiInit = Omit<RequestInit, 'body'> & { json?: unknown };

/**
 * Cliente da API usado só no servidor (Server Components e Server Actions).
 * O JWT fica num cookie httpOnly e nunca é exposto ao JavaScript do navegador.
 */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);

  let body: string | undefined;
  if (init.json !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(init.json);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers, body, cache: 'no-store' });
  } catch {
    throw new ApiError(503, 'Não foi possível falar com a API. Ela está rodando?');
  }

  const text = await res.text();
  let data: { message?: unknown } | undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    // Corpo que não é JSON (ex.: página de erro/timeout da Vercel): vira ApiError em vez de quebrar a página.
    console.error(`API ${path}: resposta ${res.status} não é JSON: ${text.slice(0, 200)}`);
    throw new ApiError(res.ok ? 502 : res.status, 'A API não respondeu como esperado. Tente de novo em instantes.');
  }
  if (!res.ok) {
    const message = typeof data?.message === 'string' ? data.message : `Erro ${res.status}`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return 'Algo deu errado. Tente de novo.';
}

/** Para páginas: transforma 404 da API em notFound() do Next. */
export async function apiOrNotFound<T>(path: string): Promise<T> {
  const { notFound } = await import('next/navigation');
  try {
    return await api<T>(path);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}
