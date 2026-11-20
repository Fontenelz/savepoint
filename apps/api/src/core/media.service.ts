import { Injectable, Logger } from '@nestjs/common';
import { list, put } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export type MediaKind = 'covers' | 'backdrops';
export type MediaDriver = 'local' | 'blob';

export const USER_AGENT = 'SavepointPortfolio/0.1 (projeto de portfolio, sem fins comerciais)';
const SAFE_KEY = /^[a-z0-9-]+$/;
const MAX_BYTES = 8_000_000;

/**
 * Armazena as imagens do catálogo (capas e banners) em um de dois lugares:
 *  - local: disco (storage/media), servido pela API em /media/*  → desenvolvimento
 *  - blob:  Vercel Blob, com URL pública própria                → produção (BLOB_READ_WRITE_TOKEN)
 * Em ambos os casos o navegador nunca carrega imagens de CDNs de terceiros.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  readonly driver: MediaDriver = process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'local';
  readonly root = resolve(process.env.MEDIA_DIR ?? join(process.cwd(), 'storage', 'media'));

  /** A URL já aponta para o nosso armazenamento (não precisa baixar de novo)? */
  isStored(url: string | null | undefined): boolean {
    if (!url) return false;
    if (url.startsWith('/media/')) return this.driver === 'local';
    try {
      return this.driver === 'blob' && new URL(url).hostname.endsWith('.blob.vercel-storage.com');
    } catch {
      return false;
    }
  }

  /** URL de um arquivo já salvo para esse slug, se existir. */
  async existing(kind: MediaKind, key: string): Promise<string | null> {
    if (!SAFE_KEY.test(key)) return null;
    try {
      if (this.driver === 'blob') {
        const { blobs } = await list({ prefix: `${kind}/${key}.`, limit: 1 });
        return blobs[0]?.url ?? null;
      }
      const files = await readdir(join(this.root, kind));
      const file = files.find((f) => f.startsWith(`${key}.`));
      return file ? `/media/${kind}/${file}` : null;
    } catch {
      return null;
    }
  }

  /**
   * Modo Blob: envia para o Blob uma imagem que já existe no disco local (storage/media).
   * Permite publicar o catálogo em produção sem baixar tudo de novo das fontes externas.
   */
  async uploadFromDisk(kind: MediaKind, key: string): Promise<string | null> {
    if (this.driver !== 'blob' || !SAFE_KEY.test(key)) return null;
    try {
      const file = (await readdir(join(this.root, kind))).find((f) => f.startsWith(`${key}.`));
      if (!file) return null;
      const ext = file.split('.').pop()!;
      const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return await this.save(kind, key, ext, type, await readFile(join(this.root, kind, file)));
    } catch {
      return null;
    }
  }

  /**
   * Tenta cada URL em ordem (ex.: o mesmo arquivo em CDNs diferentes) e salva a primeira
   * que responder com uma imagem válida.
   */
  async download(
    kind: MediaKind,
    key: string,
    urls: (string | null | undefined)[],
    opts: { patient?: boolean } = {},
  ) {
    if (!SAFE_KEY.test(key)) throw new Error(`Chave de mídia inválida: ${key}`);

    for (const url of urls) {
      if (!url) continue;
      try {
        let res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(15_000) });
        // Limite de requisições: em modo paciente (sync em lote) espera o Retry-After e tenta mais uma vez.
        for (let attempt = 0; res.status === 429 && opts.patient && attempt < 3; attempt++) {
          const seconds = Math.min(180, Number(res.headers.get('retry-after')) || 30);
          this.logger.warn(`Limite de download atingido; aguardando ${seconds}s...`);
          await new Promise((r) => setTimeout(r, seconds * 1000));
          res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(15_000) });
        }
        if (!res.ok) continue;
        const type = res.headers.get('content-type') ?? '';
        if (!type.startsWith('image/')) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 2_000 || buf.length > MAX_BYTES) continue;

        const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
        const path = await this.save(kind, key, ext, type, buf);
        return { path, from: url };
      } catch (e) {
        this.logger.debug(`Falhou ${url}: ${e instanceof Error ? e.message : e}`);
      }
    }
    return null;
  }

  /** Grava a imagem e devolve a URL pública, com ?v=<hash> para invalidar cache quando mudar. */
  private async save(kind: MediaKind, key: string, ext: string, contentType: string, buf: Buffer) {
    const version = createHash('sha1').update(buf).digest('hex').slice(0, 8);
    const name = `${key}.${ext}`;

    if (this.driver === 'blob') {
      const blob = await put(`${kind}/${name}`, buf, {
        access: 'public',
        contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60 * 60 * 24 * 30,
      });
      return `${blob.url}?v=${version}`;
    }

    const dir = join(this.root, kind);
    await mkdir(dir, { recursive: true });
    // Remove versões antigas com outra extensão
    for (const f of await readdir(dir)) if (f.startsWith(`${key}.`) && f !== name) await unlink(join(dir, f));
    await writeFile(join(dir, name), buf);
    return `/media/${kind}/${name}?v=${version}`;
  }
}
