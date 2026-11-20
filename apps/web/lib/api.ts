import 'server-only';
import { cookies } from 'next/headers';
import service from '../service.mjs';

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
 * A API chega como dependência do serviço do Composer (rawHttp), nunca de env.
 */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { api: apiDep } = service.load();
  const { json, ...rest } = init;
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);

  let body: string | undefined;
  if (json !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(json);
  }

  let res: Response;
  try {
    res = await apiDep.fetch(`/api${path}`, { ...rest, headers, body, cache: 'no-store' });
  } catch {
    throw new ApiError(503, 'Não foi possível falar com a API. Ela está rodando?');
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
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
