import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export type MediaKind = 'covers' | 'backdrops';

export const USER_AGENT = 'SavepointPortfolio/0.1 (projeto de portfolio, sem fins comerciais)';
const SAFE_KEY = /^[a-z0-9-]+$/;
const MAX_BYTES = 8_000_000;

/**
 * Armazena imagens localmente (servidas pela API em /media).
 * O navegador nunca carrega imagens de CDNs de terceiros: o app funciona mesmo
 * em redes que bloqueiam esses domínios, e o catálogo não quebra se a fonte mudar.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  readonly root = resolve(process.env.MEDIA_DIR ?? join(process.cwd(), 'storage', 'media'));

  isLocal(url: string | null | undefined): boolean {
    return Boolean(url?.startsWith('/media/'));
  }

  /** Caminho público de um arquivo já baixado para esse slug, se existir. */
  async existing(kind: MediaKind, key: string): Promise<string | null> {
    if (!SAFE_KEY.test(key)) return null;
    try {
      const files = await readdir(join(this.root, kind));
      const file = files.find((f) => f.startsWith(`${key}.`));
      return file ? `/media/${kind}/${file}` : null;
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
        const dir = join(this.root, kind);
        await mkdir(dir, { recursive: true });
        // Remove versões antigas com outra extensão
        for (const f of await readdir(dir)) if (f.startsWith(`${key}.`) && f !== `${key}.${ext}`) await unlink(join(dir, f));
        await writeFile(join(dir, `${key}.${ext}`), buf);

        const version = createHash('sha1').update(buf).digest('hex').slice(0, 8);
        return { path: `/media/${kind}/${key}.${ext}?v=${version}`, from: url };
      } catch (e) {
        this.logger.debug(`Falhou ${url}: ${e instanceof Error ? e.message : e}`);
      }
    }
    return null;
  }
}
