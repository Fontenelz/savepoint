import service from '../../../service.mjs';

export const dynamic = 'force-dynamic';

/**
 * Proxy das imagens servidas pela API em /media/* (antigo rewrite do next.config).
 * O caminho público continua sendo /media/... no próprio site.
 */
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { api } = service.load();
  const { path } = await ctx.params;
  const search = new URL(req.url).search;
  const upstream = await api.fetch(`/media/${path.join('/')}${search}`);
  return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
}
