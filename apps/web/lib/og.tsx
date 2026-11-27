import 'server-only';
import { ImageResponse } from 'next/og';
import type { ReactNode } from 'react';
import { absoluteMediaUrl } from './public-api';

/** Tamanho recomendado para pré-visualização de links (WhatsApp, X, Discord, LinkedIn…). */
export const OG_SIZE = { width: 1200, height: 630 };

/**
 * Tamanho dos Stories (Instagram, WhatsApp, Facebook): 9:16. O app cobre ~260 px em cima
 * (barra de progresso e nome) e embaixo (campo de resposta): o conteúdo fica fora dessas faixas.
 */
export const STORY_SIZE = { width: 1080, height: 1920 };

export const C = {
  bg: '#0d0e12',
  bg2: '#13151b',
  surface: '#1a1d25',
  line: '#2a2f3c',
  text: '#e8e9ef',
  text2: '#b7bbc9',
  muted: '#868ca0',
  accent: '#c6ff3d',
};

/**
 * Cache das imagens geradas. O padrão do Next em produção é 1 ano "immutable" na CDN —
 * inaceitável para imagens com dados de usuário (perfil, lista).
 */
export const OG_CACHE = {
  /** Só a marca do site. */
  brand: 'public, max-age=86400, s-maxage=604800',
  /** Dados de catálogo (capa, banner, título, ano). */
  catalog: 'public, max-age=3600, s-maxage=86400',
  /** Dados de usuário: nunca guardar. */
  user: 'private, no-store',
};

/**
 * Baixa uma imagem e devolve como data URL, só se for PNG/JPEG (formatos que o gerador lê).
 * Qualquer falha devolve null: a imagem final sai sem ela em vez de quebrar.
 */
export async function loadImage(url: string | null | undefined): Promise<string | null> {
  const abs = absoluteMediaUrl(url);
  if (!abs) return null;
  try {
    const res = await fetch(abs, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !/^image\/(png|jpe?g)/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4_000_000) return null;
    return `data:${type.split(';')[0]};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export function Logo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <rect width="48" height="48" rx="11" fill={C.bg} />
      <path fill={C.text} d="M20.5 9H16a7.5 7.5 0 0 0 0 15h4.5v-5H16a2.5 2.5 0 0 1 0-5h4.5z" />
      <path fill={C.text} d="M30 24h2a7.5 7.5 0 0 1 0 15H9v-5h23a2.5 2.5 0 0 0 0-5h-2z" />
      <path fill={C.accent} d="M21.5 9H26v14h-4.5zM26 9h12l-3.5 4.5L38 18H26zM18.5 22.5h10.5l-5.25 6z" />
    </svg>
  );
}

/** Marca no rodapé de todas as imagens. */
export function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <Logo size={40} />
      <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: C.text, letterSpacing: -0.5 }}>savepoint</div>
    </div>
  );
}

/**
 * Capa (ou um bloco neutro quando não há imagem). Moldura 3:4 por padrão, como no site;
 * `ratio` 1.5 = 2:3, o formato das capas da Steam (600×900), que assim aparecem inteiras.
 */
export function Cover({ src, width, ratio = 4 / 3 }: { src: string | null; width: number; ratio?: number }) {
  const height = Math.round(width * ratio);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={width} height={height} style={{ objectFit: 'cover', borderRadius: 10 }} alt="" />
  ) : (
    <div style={{ display: 'flex', width, height, borderRadius: 10, background: C.surface, border: `2px solid ${C.line}` }} />
  );
}

/** Linha em degradê, como a da navbar do site. */
export function GradientLine() {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: 6,
        backgroundImage: 'linear-gradient(90deg, #c6ff3d, #5cc8ff, #c38bff, #ff5a7a)',
      }}
    />
  );
}

export function ogImage(element: ReactNode, cache: string) {
  return new ImageResponse(element as React.ReactElement, { ...OG_SIZE, headers: { 'cache-control': cache } });
}
