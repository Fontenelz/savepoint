import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { listSchema, type ListDetail, type ListSummary, type Paginated } from '@savepoint/shared';
import type { z } from 'zod';
import { gameSummary, listRows, paged, paginate, toGameSummary, toListSummary, userSummaryFields } from '../core/mappers';
import { db } from '../core/runtime';
import { PrismaService } from '../core/prisma.service';

type ListInput = z.output<typeof listSchema>;
const PAGE_SIZE = 20;

@Injectable()
export class ListsService {
  constructor(private readonly prisma: PrismaService) {}

  async browse(page: number): Promise<Paginated<ListSummary>> {
    const [rows, total] = await Promise.all([
      listRows()
        .where((gl) => gl.items.some())
        .orderBy((gl) => gl.updatedAt.desc())
        .offset(paginate(page, PAGE_SIZE).offset)
        .limit(PAGE_SIZE)
        .all(),
      db.orm.public.GameList.where((gl) => gl.items.some()).aggregate((a) => ({ n: a.count() })),
    ]);
    return paged(rows.map(toListSummary), total.n, page, PAGE_SIZE);
  }

  async get(id: string, viewerId?: string): Promise<ListDetail> {
    const list = await db.orm.public.GameList
      .where({ id })
      .select('id', 'title', 'description', 'ranked', 'updatedAt')
      .include('user', (u) => u.select(...userSummaryFields))
      .include('items', (items) =>
        items.combine({
          count: items.count(),
          all: items.orderBy((i) => i.position.asc()).include("game", (g) => g.with(gameSummary) as never),
        }),
      )
      .first();
    if (!list) throw new NotFoundException('Lista não encontrada');

    return {
      ...toListSummary({ ...list, items: { count: list.items.count, preview: list.items.all.slice(0, 5) } } as never),
      isOwner: list.user!.id === viewerId,
      items: list.items.all.map((i) => ({ position: i.position, note: i.note, game: toGameSummary(i.game) })),
    };
  }

  async create(userId: string, input: ListInput) {
    const ids = [...new Set(input.gameIds)];
    await this.assertGames(ids);
    const list = await db.orm.public.GameList.create({
      userId,
      title: input.title,
      description: input.description ?? null,
      ranked: input.ranked,
      items: (i) => i.create(ids.map((gameId, i) => ({ gameId, position: i + 1 }))),
    });
    return { id: list.id };
  }

  async update(userId: string, id: string, input: ListInput) {
    await this.assertOwner(userId, id);
    const ids = [...new Set(input.gameIds)];
    await this.assertGames(ids);
    await db.transaction(async (tx) => {
      await tx.orm.public.ListItem.where({ listId: id }).deleteAll();
      await tx.orm.public.GameList.where({ id }).update({
        title: input.title,
        description: input.description ?? null,
        ranked: input.ranked,
        items: (i) => i.create(ids.map((gameId, i) => ({ gameId, position: i + 1 }))),
      });
    });
    return { id };
  }

  async addItem(userId: string, id: string, gameId: string) {
    await this.assertOwner(userId, id);
    await this.assertGames([gameId]);
    const exists = await db.orm.public.ListItem.where({ listId: id, gameId }).first();
    if (exists) return { id, added: false };
    const last = await db.orm.public.ListItem.where({ listId: id }).aggregate((a) => ({ max: a.max('position') }));
    await db.transaction(async (tx) => {
      await tx.orm.public.ListItem.create({ listId: id, gameId, position: (last.max ?? 0) + 1 });
      await tx.orm.public.GameList.where({ id }).update({ updatedAt: new Date() });
    });
    return { id, added: true };
  }

  async remove(userId: string, id: string) {
    await this.assertOwner(userId, id);
    await db.orm.public.GameList.where({ id }).delete();
  }

  /** Garante que todos os jogos informados existem (evita erro de chave estrangeira). */
  private async assertGames(ids: string[]) {
    if (!ids.length) return;
    const found = await db.orm.public.Game
      .where((g) => g.id.in(ids))
      .aggregate((a) => ({ n: a.count() }));
    if (found.n !== ids.length) throw new BadRequestException('Algum jogo da lista não existe no catálogo');
  }

  private async assertOwner(userId: string, id: string) {
    const list = await db.orm.public.GameList.where({ id }).select('userId').first();
    if (!list) throw new NotFoundException('Lista não encontrada');
    if (list.userId !== userId) throw new ForbiddenException('Essa lista não é sua');
  }
}
