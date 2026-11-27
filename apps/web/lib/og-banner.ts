import 'server-only';
import sharp from 'sharp';
import { OG_SIZE } from './og';
import { absoluteMediaUrl } from './public-api';

/**
 * Banner do jogo recortado em 1200×630 e salvo como JPEG leve, para a prévia de links
 * (estilo Letterboxd: a foto ocupa o cartão inteiro). Os banners originais passam de 1 MB
 * e o WhatsApp descarta prévias pesadas; assim ficam em ~100 KB.
 * Qualquer falha devolve null: quem chama cai no cartão gerado.
 */
export async function bannerJpeg(url: string | null | undefined): Promise<Buffer | null> {
  const abs = absoluteMediaUrl(url);
  if (!abs) return null;
  try {
    const res = await fetch(abs, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) return null;
    const input = Buffer.from(await res.arrayBuffer());
    return await sharp(input)
      .resize(OG_SIZE.width, OG_SIZE.height, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

/** Resposta HTTP com o JPEG do banner. */
export function bannerResponse(jpeg: Buffer, cache: string) {
  return new Response(new Uint8Array(jpeg), {
    headers: { 'content-type': 'image/jpeg', 'cache-control': cache },
  });
}
