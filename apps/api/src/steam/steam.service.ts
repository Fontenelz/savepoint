import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  PlayStatus,
  SteamAccount,
  SteamImportInput,
  SteamImportResult,
  SteamLibrary,
  SteamLibraryItem,
} from '@savepoint/shared';
import { CatalogService } from '../catalog/catalog.service';
import { SteamStoreClient, plainText, type SteamAppDetails } from '../catalog/providers/steam-store.client';
import { STEAM_HOSTS } from '../catalog/providers/wiki-steam.source';
import { steamSuggestsEndless } from '../catalog/endless-hint';
import { gameSummarySelect, toGameSummary } from '../core/mappers';
import { AuthService } from '../auth/auth.service';
import { applyAccountProfile } from '../core/account-profile';
import { JourneyService } from '../core/journey.service';
import { MediaService } from '../core/media.service';
import { PrismaService } from '../core/prisma.service';
import { StatsService } from '../core/stats.service';
import { GamesService } from '../games/games.service';
import { SteamApiClient, type SteamOwnedGame } from './steam-api.client';

const accountSelect = {
  steamId: true,
  steamName: true,
  steamAvatar: true,
  steamLinkedAt: true,
  steamSyncedAt: true,
} satisfies Prisma.UserSelect;

/** Apps fora da loja cujo nome indica que não são jogos (a loja não está lá para dizer o tipo). */
const NOT_A_GAME = /\b(test server|public test|dedicated server|sdk|benchmark|soundtrack)\b/i;

const toHours = (minutes: number) => (minutes > 0 ? Math.round(minutes / 6) / 10 : null);

@Injectable()
export class SteamService {
  private readonly logger = new Logger(SteamService.name);

  constructor(
    private readonly steam: SteamApiClient,
    private readonly store: SteamStoreClient,
    private readonly prisma: PrismaService,
    private readonly stats: StatsService,
    private readonly media: MediaService,
    private readonly catalog: CatalogService,
    private readonly games: GamesService,
    private readonly auth: AuthService,
    private readonly journey: JourneyService,
  ) {}

  enabled() {
    return { enabled: this.steam.isEnabled() };
  }

  async account(userId: string): Promise<SteamAccount | null> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: accountSelect });
    return u?.steamId ? this.toAccount(u) : null;
  }

  async link(userId: string, params: Record<string, string>): Promise<SteamAccount> {
    const steamId = await this.steam.verifyOpenId(params);
    const owner = await this.prisma.user.findUnique({ where: { steamId }, select: { id: true } });
    if (owner && owner.id !== userId) {
      throw new ConflictException('Essa conta Steam já está conectada a outro usuário do Savepoint.');
    }
    const player = await this.steam.player(steamId).catch(() => null);
    const u = await this.prisma.user.update({
      where: { id: userId },
      data: {
        steamId,
        steamName: player?.name ?? null,
        steamAvatar: player?.avatarUrl ?? null,
        steamLinkedAt: new Date(),
      },
      select: accountSelect,
    });
    await applyAccountProfile(this.prisma, userId);
    return this.toAccount(u);
  }

  /**
   * "Entrar com a Steam": só para contas que já conectaram a Steam (a Steam não fornece e-mail,
   * e criar conta só com ela não foi adotado). Atualiza nome/avatar da Steam a cada login.
   */
  async login(params: Record<string, string>) {
    const steamId = await this.steam.verifyOpenId(params);
    const owner = await this.prisma.user.findUnique({ where: { steamId }, select: { id: true } });
    if (!owner) {
      throw new NotFoundException(
        'Essa conta Steam não está conectada a nenhum usuário. Entre com sua conta e conecte a Steam em Configurações.',
      );
    }
    const player = await this.steam.player(steamId).catch(() => null);
    if (player) {
      await this.prisma.user.update({
        where: { id: owner.id },
        data: { steamName: player.name, steamAvatar: player.avatarUrl },
      });
    }
    await applyAccountProfile(this.prisma, owner.id);
    return this.auth.sessionFor(owner.id);
  }

  async unlink(userId: string) {
    // A estante importada continua: só o vínculo com a conta é desfeito.
    await this.prisma.user.update({
      where: { id: userId },
      data: { steamId: null, steamName: null, steamAvatar: null, steamLinkedAt: null, steamSyncedAt: null },
    });
    // Sem Steam, foto/nome voltam para o Google (se conectado) ou ficam como estão.
    await applyAccountProfile(this.prisma, userId);
  }

  /** Prévia da biblioteca: jogos da Steam cruzados com o catálogo e com a estante do usuário. */
  async library(userId: string): Promise<SteamLibrary> {
    const account = await this.requireAccount(userId);
    const owned = await this.steam.ownedGames(account.steamId, { fresh: true });
    if (owned.private) return { account, private: true, items: [] };

    const appIds = owned.games.map((g) => String(g.appid));
    const games = await this.prisma.game.findMany({
      where: { steamAppId: { in: appIds } },
      select: { ...gameSummarySelect, steamAppId: true },
    });
    const byApp = new Map(games.map((g) => [g.steamAppId!, g]));
    const entries = await this.prisma.userGame.findMany({
      where: { userId, gameId: { in: games.map((g) => g.id) } },
      select: { gameId: true, status: true, hoursPlayed: true },
    });
    const entryByGame = new Map(entries.map((e) => [e.gameId, e]));

    const items = owned.games.map((o): SteamLibraryItem => {
      const appId = String(o.appid);
      const game = byApp.get(appId);
      const entry = game ? entryByGame.get(game.id) : undefined;
      return {
        appId,
        name: o.name ?? game?.title ?? `App ${appId}`,
        minutes: o.playtime_forever,
        recent: (o.playtime_2weeks ?? 0) > 0,
        lastPlayedAt: o.rtime_last_played ? new Date(o.rtime_last_played * 1000).toISOString() : null,
        imageUrl: `https://${STEAM_HOSTS[2]}/steam/apps/${appId}/capsule_184x69.jpg`,
        game: game ? toGameSummary(game) : null,
        entry: entry ? { status: entry.status, hoursPlayed: entry.hoursPlayed } : null,
        suggestedStatus: this.suggest(o),
      };
    });
    items.sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name, 'pt-BR'));
    return { account, private: false, items };
  }

  /**
   * Importa um lote de jogos: cria no catálogo os que ainda não existem (dados e imagens
   * copiados da loja da Steam) e coloca na estante com as horas jogadas.
   * As horas vêm sempre da Steam, nunca do navegador.
   */
  async import(userId: string, input: SteamImportInput): Promise<SteamImportResult> {
    const account = await this.requireAccount(userId);
    const owned = await this.steam.ownedGames(account.steamId);
    const ownedByApp = new Map(owned.games.map((g) => [String(g.appid), g]));
    const pc = await this.prisma.platform.findFirst({ where: { slug: 'pc' }, select: { id: true } });

    const result: SteamImportResult = { added: 0, updated: 0, createdGames: 0, skipped: [] };
    const touched = new Set<string>();

    for (const item of input.items) {
      const o = ownedByApp.get(item.appId);
      if (!o) {
        result.skipped.push({ appId: item.appId, reason: 'Não está na sua biblioteca da Steam.' });
        continue;
      }
      try {
        let game = await this.prisma.game.findFirst({
          where: { steamAppId: item.appId },
          select: { id: true, steamScore: true },
        });
        if (!game) {
          const created = await this.createFromStore(item.appId, o.name ?? null);
          if ('skip' in created) {
            result.skipped.push({ appId: item.appId, reason: created.skip });
            continue;
          }
          game = { id: created.id, steamScore: null };
          if (created.isNew) result.createdGames++;
        }
        if (game.steamScore == null) await this.fillSteamScore(game.id, item.appId);

        const hours = toHours(o.playtime_forever);
        const entry = await this.prisma.userGame.findUnique({
          where: { userId_gameId: { userId, gameId: game.id } },
          select: { status: true, hoursPlayed: true },
        });
        if (entry) {
          const data: Prisma.UserGameUpdateInput = {};
          if (hours !== null && hours !== entry.hoursPlayed) data.hoursPlayed = hours;
          if (!entry.status && item.status) data.status = item.status;
          if (Object.keys(data).length) {
            await this.prisma.userGame.update({ where: { userId_gameId: { userId, gameId: game.id } }, data });
          }
          // Status novo abre/fecha o save, sem checkpoints (não inunda o diário/feed com a importação).
          if (data.status) await this.journey.applyStatus(this.prisma, userId, game.id, item.status, { checkpoints: false });
          result.updated++;
        } else {
          await this.prisma.userGame.create({
            data: { userId, gameId: game.id, status: item.status, hoursPlayed: hours, platformId: pc?.id ?? null },
          });
          await this.journey.applyStatus(this.prisma, userId, game.id, item.status, {
            platformId: pc?.id ?? null,
            checkpoints: false,
          });
          result.added++;
        }
        touched.add(game.id);
      } catch (e) {
        this.logger.warn(`Importação Steam ${item.appId}: ${e instanceof Error ? e.message : e}`);
        result.skipped.push({ appId: item.appId, reason: e instanceof Error ? e.message : 'Erro inesperado.' });
      }
    }

    for (const id of touched) await this.stats.refreshGame(id);
    await this.prisma.user.update({ where: { id: userId }, data: { steamSyncedAt: new Date() } });
    return result;
  }

  /** Guarda as avaliações da loja (base da nota sugerida). Falhar aqui não impede a importação. */
  private async fillSteamScore(gameId: string, appId: string) {
    try {
      const summary = await this.store.reviewSummary(appId);
      if (summary) {
        await this.prisma.game.update({
          where: { id: gameId },
          data: { steamScore: summary.score, steamReviewCount: summary.total },
        });
      }
    } catch (e) {
      this.logger.warn(`Avaliações Steam ${appId}: ${e instanceof Error ? e.message : e}`);
    }
  }

  /**
   * Cria o jogo no catálogo a partir da loja da Steam (textos em PT-BR, imagens copiadas).
   * Jogos retirados da loja (ex.: F1 2019) entram só com o nome da biblioteca.
   */
  private async createFromStore(
    appId: string,
    ownedName: string | null,
  ): Promise<{ id: string; isNew: boolean } | { skip: string }> {
    const store = await this.store.appDetails(appId);
    let d: SteamAppDetails;
    if (store) {
      if (store.type !== 'game') return { skip: 'Não é um jogo (DLC, trilha sonora, ferramenta ou vídeo).' };
      d = store;
    } else {
      if (!ownedName) return { skip: 'Não encontrado na loja da Steam.' };
      if (NOT_A_GAME.test(ownedName)) return { skip: 'Não é um jogo (servidor de testes ou ferramenta).' };
      d = { type: 'game', name: ownedName };
    }

    const year = Number(/\b(19|20)\d{2}\b/.exec(d.release_date?.date ?? '')?.[0]) || null;
    const [genreIds, platformIds] = await Promise.all([
      this.catalog.upsertGenres({ genres: (d.genres ?? []).map((g) => g.description) }),
      this.catalog.upsertPlatforms({ platforms: [{ name: 'PC', short: 'PC' }] }),
    ]);
    const slug = await this.games.uniqueSlug(d.name, year);

    let game: { id: string };
    try {
      game = await this.prisma.game.create({
        data: {
          slug,
          title: d.name,
          summary: plainText(d.short_description),
          releaseYear: year,
          developer: d.developers?.[0] ?? null,
          publisher: d.publishers?.[0] ?? null,
          source: 'STEAM',
          externalId: appId,
          steamAppId: appId,
          endlessHint: steamSuggestsEndless(d),
          genres: { connect: genreIds.map((id) => ({ id })) },
          platforms: { connect: platformIds.map((id) => ({ id })) },
        },
        select: { id: true },
      });
    } catch (e) {
      // Outra importação criou o mesmo jogo ao mesmo tempo.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await this.prisma.game.findFirst({ where: { steamAppId: appId }, select: { id: true } });
        if (existing) return { id: existing.id, isNew: false };
      }
      throw e;
    }

    // Copia capa (vertical) e banner para o nosso armazenamento: nada fica dependendo da Steam.
    const [cover, backdrop] = await Promise.all([
      this.media.download('covers', slug, [
        ...STEAM_HOSTS.map((h) => `https://${h}/steam/apps/${appId}/library_600x900_2x.jpg`),
        ...STEAM_HOSTS.map((h) => `https://${h}/steam/apps/${appId}/library_600x900.jpg`),
      ]),
      this.media.download('backdrops', slug, STEAM_HOSTS.map((h) => `https://${h}/steam/apps/${appId}/library_hero.jpg`)),
    ]);
    if (cover || backdrop) {
      await this.prisma.game.update({
        where: { id: game.id },
        data: { ...(cover ? { coverUrl: cover.path } : {}), ...(backdrop ? { backdropUrl: backdrop.path } : {}) },
      });
    }
    return { id: game.id, isNew: true };
  }

  /** Nunca jogado → Quero jogar; jogado nas últimas 2 semanas → Jogando; o resto fica para o usuário. */
  private suggest(o: SteamOwnedGame): PlayStatus | null {
    if (o.playtime_forever === 0) return 'BACKLOG';
    if ((o.playtime_2weeks ?? 0) > 0) return 'PLAYING';
    return null;
  }

  private async requireAccount(userId: string): Promise<SteamAccount> {
    const account = await this.account(userId);
    if (!account) throw new NotFoundException('Conecte sua conta Steam primeiro.');
    return account;
  }

  private toAccount(u: Prisma.UserGetPayload<{ select: typeof accountSelect }>): SteamAccount {
    return {
      steamId: u.steamId!,
      name: u.steamName,
      avatarUrl: u.steamAvatar,
      profileUrl: `https://steamcommunity.com/profiles/${u.steamId}`,
      linkedAt: (u.steamLinkedAt ?? new Date()).toISOString(),
      syncedAt: u.steamSyncedAt?.toISOString() ?? null,
    };
  }
}

