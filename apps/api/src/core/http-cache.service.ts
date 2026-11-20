import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

interface Entry<T> {
  url: string;
  fetchedAt: number;
  body: T;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Cache em disco para respostas de APIs externas (GET JSON).
 * Evita repetir consultas à Wikipedia/Wikidata a cada execução do sync:
 * só respostas bem-sucedidas são guardadas, por `ttlDays` (padrão 30 dias).
 */
@Injectable()
export class HttpCacheService {
  // Na Vercel só /tmp é gravável (o cache vive enquanto a instância da função viver).
  readonly root = resolve(
    process.env.HTTP_CACHE_DIR ??
      (process.env.VERCEL ? join(tmpdir(), 'savepoint-http-cache') : join(process.cwd(), 'storage', 'cache', 'http')),
  );

  private file(url: string) {
    return join(this.root, `${createHash('sha1').update(url).digest('hex')}.json`);
  }

  async get<T>(url: string, ttlDays = 30): Promise<T | undefined> {
    try {
      const entry = JSON.parse(await readFile(this.file(url), 'utf8')) as Entry<T>;
      if (Date.now() - entry.fetchedAt > ttlDays * DAY) return undefined;
      return entry.body;
    } catch {
      return undefined; // não existe ou está corrompido
    }
  }

  async set<T>(url: string, body: T): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const entry: Entry<T> = { url, fetchedAt: Date.now(), body };
    await writeFile(this.file(url), JSON.stringify(entry));
  }

  async clear(): Promise<void> {
    await rm(this.root, { recursive: true, force: true });
  }
}
