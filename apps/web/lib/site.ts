import 'server-only';

/**
 * Endereço público do site (URLs canônicas, sitemap e imagens de compartilhamento).
 * Ordem: SITE_URL (definida à mão; troque se o domínio mudar) → domínio de produção
 * informado pela Vercel → localhost.
 */
export const SITE_URL = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
  'http://localhost:3000'
).replace(/\/+$/, '');

export const SITE_NAME = 'Savepoint';
export const SITE_DESCRIPTION =
  'Registre o que você jogou, avalie, monte listas e descubra jogos pelo que seus amigos estão jogando.';

/** Texto de meta description: sem quebras e com no máximo ~160 caracteres. */
export function metaDescription(text: string | null | undefined, fallback = SITE_DESCRIPTION) {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.length > 160 ? `${clean.slice(0, 157).replace(/\s+\S*$/, '')}…` : clean;
}

/**
 * Metadados de uma página pública: canônica + Open Graph + cartão do X.
 * Necessário porque o `openGraph` de uma página substitui o do layout inteiro (perderia site e idioma).
 * Rotas com opengraph-image.tsx próprio passam ownImage: true.
 */
export function publicPageMeta({
  title,
  description,
  path,
  type = 'website',
  ownImage = false,
}: {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'profile' | 'article';
  /** A rota tem opengraph-image.tsx próprio. Imagem configurada aqui SUBSTITUIRIA a do arquivo. */
  ownImage?: boolean;
}) {
  // Sem imagem própria, a página perderia a imagem herdada ao definir o próprio openGraph: usa a da marca.
  // Com imagem própria, a chave `images` NÃO pode existir (nem vazia): o Next a trata como
  // "sem imagem" e descarta a do opengraph-image.tsx (verificado no HTML gerado).
  const images = ownImage
    ? {}
    : { images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Savepoint — seu diário de jogos' }] };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type, siteName: SITE_NAME, locale: 'pt_BR', title, description, url: path, ...images },
    twitter: { card: 'summary_large_image' as const, title, description, ...images },
  };
}
