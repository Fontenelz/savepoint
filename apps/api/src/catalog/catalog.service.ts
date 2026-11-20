import { Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { slugify, type CatalogStatus, type ExternalGameResult } from '@savepoint/shared';
import { MediaService } from '../core/media.service';
import { PrismaService } from '../core/prisma.service';
import { GamesService } from '../games/games.service';
import { ARTWORK_SOURCES, type ArtworkSource } from './providers/artwork-source';
import { CATALOG_PROVIDERS, matchScore, type CatalogProvider, type ExternalGame } from './providers/catalog-provider';

export interface EnrichResult {
  slug: string;
  title: string;
  cover: boolean;
  backdrop: boolean;
  source: string | null;
  matched: string | null;
}

export interface SyncReport {
  total: number;
  results: EnrichResult[];
  failed: { slug: string; error: string }[];
}

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    @Inject(CATALOG_PROVIDERS) private readonly providers: CatalogProvider[],
    @Inject(ARTWORK_SOURCES) private readonly artwork: ArtworkSource[],
    private readonly prisma: PrismaService,
    private readonly games: GamesService,
    private readonly media: MediaService,
  ) {}

  status(): CatalogStatus {
    const list = (items: { id: string; name: string; isEnabled(): boolean }[]) =>
      items.map((p) => ({ id: p.id, name: p.name, enabled: p.isEnabled() }));
    return { providers: list(this.providers), artwork: list(this.artwork) };
  }

  private provider(id = 'igdb') {
    const p = this.providers.find((x) => x.id === id);
    if (!p || !p.isEnabled()) throw new ServiceUnavailableException('Nenhuma fonte externa configurada');
    return p;
  }

  async search(q: string): Promise<ExternalGameResult[]> {
    const provider = this.provider();
    const results = await provider.search(q);
    const imported = await this.prisma.game.findMany({
      where: { igdbId: { in: results.map((r) => r.externalId) } },
      select: { igdbId: true, slug: true },
    });
    const byId = new Map(imported.map((g) => [g.igdbId, g.slug]));
    return results.map((r) => ({
      externalId: r.externalId,
      title: r.title,
      releaseYear: r.releaseYear,
      coverUrl: r.coverUrl,
      platforms: r.platforms.map((p) => p.short),
      importedSlug: byId.get(r.externalId) ?? null,
    }));
  }

  /** Copia o jogo para o banco local (idempotente). */
  async import(externalId: string, userId: string | null): Promise<{ slug: string }> {
    const provider = this.provider();
    const existing = await this.prisma.game.findUnique({ where: { igdbId: externalId }, select: { slug: true } });
    if (existing) return existing;

    const ext = await provider.fetch(externalId);
    if (!ext) throw new NotFoundException('Jogo não encontrado na fonte externa');
    const { slug } = await this.importExternal(ext, userId);
    return { slug };
  }

  /**
   * Salva um jogo externo já obtido no banco local e baixa as imagens para o nosso armazenamento.
   * Idempotente: se o jogo já existe (pelo id externo ou mesmo título + ano), só vincula o id.
   */
  async importExternal(
    ext: ExternalGame,
    userId: string | null,
  ): Promise<{ slug: string; status: 'created' | 'linked' | 'exists' }> {
    const existing = await this.prisma.game.findUnique({ where: { igdbId: ext.externalId }, select: { slug: true } });
    if (existing) return { slug: existing.slug, status: 'exists' };

    const local = await this.findLocalMatch(ext);
    if (local) {
      await this.prisma.game.update({ where: { id: local.id }, data: { igdbId: ext.externalId } });
      return { slug: local.slug, status: 'linked' };
    }

    const [genreIds, platformIds] = await Promise.all([this.upsertGenres(ext), this.upsertPlatforms(ext)]);
    const slug = await this.games.uniqueSlug(ext.title, ext.releaseYear);

    await this.prisma.game.create({
      data: {
        slug,
        title: ext.title,
        summary: ext.summary,
        releaseYear: ext.releaseYear,
        developer: ext.developer,
        publisher: ext.publisher,
        coverUrl: ext.coverUrl,
        backdropUrl: ext.backdropUrl,
        avgHours: ext.avgHours,
        source: 'IGDB',
        externalId: ext.externalId,
        igdbId: ext.externalId,
        createdById: userId,
        genres: { connect: genreIds.map((id) => ({ id })) },
        platforms: { connect: platformIds.map((id) => ({ id })) },
      },
    });
    // Baixa as imagens para o armazenamento local (não depender do CDN externo).
    await this.enrichGame(slug).catch(() => undefined);
    return { slug, status: 'created' };
  }

  /** Jogo local sem id do IGDB com o mesmo título e ano (ex.: os jogos curados do seed). */
  private async findLocalMatch(ext: ExternalGame) {
    const candidates = await this.prisma.game.findMany({
      where: { igdbId: null },
      select: { id: true, slug: true, title: true, releaseYear: true },
    });
    return (
      candidates.find((g) => matchScore({ title: g.title, year: g.releaseYear }, ext) >= 130) ?? null
    );
  }

  /**
   * Enriquece um jogo com capa/banner: tenta as fontes em ordem, baixa as imagens para
   * o armazenamento local e grava IDs externos. Textos locais (sinopses PT-BR) são mantidos.
   */
  async enrichGame(slug: string, opts: { force?: boolean; patient?: boolean } = {}): Promise<EnrichResult> {
    const g = await this.prisma.game.findUnique({
      where: { slug },
      select: {
        id: true, slug: true, title: true, releaseYear: true, coverUrl: true, backdropUrl: true,
        developer: true, publisher: true, igdbId: true, wikidataId: true, steamAppId: true,
      },
    });
    if (!g) throw new NotFoundException('Jogo não encontrado');

    const data: Prisma.GameUpdateInput = {};
    let cover = this.media.isStored(g.coverUrl) && !opts.force ? g.coverUrl : null;
    let backdrop = this.media.isStored(g.backdropUrl) && !opts.force ? g.backdropUrl : null;
    let source: string | null = null;
    let matched: string | null = null;

    // 1) Arquivos já baixados antes (ex.: depois de um db:reset) — sem rede.
    if (!opts.force) {
      cover ??= await this.media.existing('covers', g.slug);
      backdrop ??= await this.media.existing('backdrops', g.slug);
      // Produção (Blob): reaproveita as imagens já baixadas no disco local, sem consultar fontes externas.
      cover ??= await this.media.uploadFromDisk('covers', g.slug);
      backdrop ??= await this.media.uploadFromDisk('backdrops', g.slug);
      if (cover && cover !== g.coverUrl) data.coverUrl = cover;
      if (backdrop && backdrop !== g.backdropUrl) data.backdropUrl = backdrop;
    }

    // 2) URL remota informada pelo usuário/importação: traz para o nosso armazenamento.
    if (!cover && g.coverUrl && /^https?:\/\//.test(g.coverUrl) && !this.media.isStored(g.coverUrl)) {
      const saved = await this.media.download('covers', g.slug, [g.coverUrl], opts);
      if (saved) data.coverUrl = cover = saved.path;
    }

    // 3) Fontes de arte, em ordem de prioridade, até ter capa e banner.
    for (const src of this.artwork.filter((s) => s.isEnabled())) {
      if (cover && backdrop) break;
      const found = await src.findArtwork(g).catch((e) => {
        this.logger.warn(`${src.name} falhou para ${g.title}: ${e instanceof Error ? e.message : e}`);
        return null;
      });
      if (!found) continue;
      source ??= found.source;
      matched ??= found.matchedTitle;

      if (!cover) {
        const saved = await this.media.download('covers', g.slug, found.covers, opts);
        if (saved) data.coverUrl = cover = saved.path;
      }
      if (!backdrop) {
        const saved = await this.media.download('backdrops', g.slug, found.backdrops, opts);
        if (saved) data.backdropUrl = backdrop = saved.path;
      }
      if (found.refs.wikidataId && !g.wikidataId) data.wikidataId = found.refs.wikidataId;
      if (found.refs.steamAppId && !g.steamAppId) data.steamAppId = found.refs.steamAppId;
      if (found.refs.igdbId && !g.igdbId) {
        const taken = await this.prisma.game.findUnique({ where: { igdbId: found.refs.igdbId }, select: { id: true } });
        if (!taken) data.igdbId = found.refs.igdbId;
      }
      if (!g.developer && found.developer) data.developer = found.developer;
      if (!g.publisher && found.publisher) data.publisher = found.publisher;
    }

    if (Object.keys(data).length) await this.prisma.game.update({ where: { id: g.id }, data });
    return { slug: g.slug, title: g.title, cover: Boolean(cover), backdrop: Boolean(backdrop), source, matched };
  }

  /** Enriquece todo o catálogo (por padrão só jogos sem capa/banner local). */
  async sync(opts: { force?: boolean; onProgress?: (msg: string) => void } = {}): Promise<SyncReport> {
    const games = await this.prisma.game.findMany({
      where: opts.force
        ? {}
        : {
            OR: [
              { coverUrl: null },
              { backdropUrl: null },
              // local: falta baixar o que não está em /media; blob: falta enviar o que ainda é /media ou externo
              this.media.driver === 'local'
                ? { NOT: { coverUrl: { startsWith: '/media/' } } }
                : { NOT: { coverUrl: { contains: '.blob.vercel-storage.com' } } },
              ...(this.media.driver === 'blob' ? [{ NOT: { backdropUrl: { contains: '.blob.vercel-storage.com' } } }] : []),
            ],
          },
      orderBy: { title: 'asc' },
      select: { slug: true, title: true },
    });

    const report: SyncReport = { total: games.length, results: [], failed: [] };
    for (const [i, g] of games.entries()) {
      const prefix = `[${String(i + 1).padStart(2)}/${games.length}] ${g.title}`;
      try {
        const r = await this.enrichGame(g.slug, { force: opts.force, patient: true });
        report.results.push(r);
        const marks = `${r.cover ? '🖼 capa' : '· sem capa'}  ${r.backdrop ? '🌄 banner' : '· sem banner'}`;
        opts.onProgress?.(`${prefix} — ${marks}${r.matched && r.matched !== g.title ? `  (via “${r.matched}”)` : ''}`);
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        report.failed.push({ slug: g.slug, error });
        opts.onProgress?.(`${prefix} ✗ ${error}`);
      }
    }
    return report;
  }

  async upsertGenres(ext: Pick<ExternalGame, 'genres'>) {
    const ids: string[] = [];
    for (const name of ext.genres) {
      const slug = slugify(name);
      if (!slug) continue;
      const g = await this.prisma.genre.upsert({ where: { slug }, create: { slug, name }, update: {}, select: { id: true } });
      ids.push(g.id);
    }
    return ids;
  }

  async upsertPlatforms(ext: Pick<ExternalGame, 'platforms'>) {
    const ids: string[] = [];
    for (const p of ext.platforms) {
      // Tenta casar com plataformas já cadastradas pelo nome curto ou completo.
      const match = await this.prisma.platform.findFirst({
        where: {
          OR: [
            { short: { equals: p.short, mode: 'insensitive' } },
            { name: { equals: p.name, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      if (match) {
        ids.push(match.id);
        continue;
      }
      const slug = slugify(p.name);
      if (!slug) continue;
      const created = await this.prisma.platform.upsert({
        where: { slug },
        create: { slug, name: p.name, short: p.short },
        update: {},
        select: { id: true },
      });
      ids.push(created.id);
    }
    return ids;
  }
}
