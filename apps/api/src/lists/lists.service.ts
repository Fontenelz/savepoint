import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { listSchema, type ListDetail, type ListSummary, type Paginated } from '@savepoint/shared';
import type { z } from 'zod';
import { gameSummarySelect, listSummarySelect, paged, paginate, toGameSummary, toListSummary } from '../core/mappers';
import { PrismaService } from '../core/prisma.service';

type ListInput = z.output<typeof listSchema>;
const PAGE_SIZE = 20;

@Injectable()
export class ListsService {
  constructor(private readonly prisma: PrismaService) {}

  async browse(page: number): Promise<Paginated<ListSummary>> {
    const [rows, total] = await Promise.all([
      this.prisma.gameList.findMany({
        where: { items: { some: {} } },
        orderBy: { updatedAt: 'desc' },
        select: listSummarySelect,
        ...paginate(page, PAGE_SIZE),
      }),
      this.prisma.gameList.count({ where: { items: { some: {} } } }),
    ]);
    return paged(rows.map(toListSummary), total, page, PAGE_SIZE);
  }

  async get(id: string, viewerId?: string): Promise<ListDetail> {
    const list = await this.prisma.gameList.findUnique({
      where: { id },
      select: {
        ...listSummarySelect,
        items: {
          orderBy: { position: 'asc' },
          select: { position: true, note: true, game: { select: gameSummarySelect } },
        },
      },
    });
    if (!list) throw new NotFoundException('Lista não encontrada');

    return {
      ...toListSummary({ ...list, items: list.items.slice(0, 5) }),
      isOwner: list.user.id === viewerId,
      items: list.items.map((i) => ({ position: i.position, note: i.note, game: toGameSummary(i.game) })),
    };
  }

  async create(userId: string, input: ListInput) {
    const ids = [...new Set(input.gameIds)];
    await this.assertGames(ids);
    const list = await this.prisma.gameList.create({
      data: {
        userId,
        title: input.title,
        description: input.description ?? null,
        ranked: input.ranked,
        items: { create: ids.map((gameId, i) => ({ gameId, position: i + 1 })) },
      },
      select: { id: true },
    });
    return list;
  }

  async update(userId: string, id: string, input: ListInput) {
    await this.assertOwner(userId, id);
    const ids = [...new Set(input.gameIds)];
    await this.assertGames(ids);
    await this.prisma.$transaction([
      this.prisma.listItem.deleteMany({ where: { listId: id } }),
      this.prisma.gameList.update({
        where: { id },
        data: {
          title: input.title,
          description: input.description ?? null,
          ranked: input.ranked,
          items: { create: ids.map((gameId, i) => ({ gameId, position: i + 1 })) },
        },
      }),
    ]);
    return { id };
  }

  async addItem(userId: string, id: string, gameId: string) {
    await this.assertOwner(userId, id);
    await this.assertGames([gameId]);
    const exists = await this.prisma.listItem.findUnique({ where: { listId_gameId: { listId: id, gameId } } });
    if (exists) return { id, added: false };
    const last = await this.prisma.listItem.aggregate({ where: { listId: id }, _max: { position: true } });
    await this.prisma.$transaction([
      this.prisma.listItem.create({ data: { listId: id, gameId, position: (last._max.position ?? 0) + 1 } }),
      this.prisma.gameList.update({ where: { id }, data: { updatedAt: new Date() } }),
    ]);
    return { id, added: true };
  }

  async remove(userId: string, id: string) {
    await this.assertOwner(userId, id);
    await this.prisma.gameList.delete({ where: { id } });
  }

  /** Garante que todos os jogos informados existem (evita erro de chave estrangeira). */
  private async assertGames(ids: string[]) {
    if (!ids.length) return;
    const found = await this.prisma.game.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new BadRequestException('Algum jogo da lista não existe no catálogo');
  }

  private async assertOwner(userId: string, id: string) {
    const list = await this.prisma.gameList.findUnique({ where: { id }, select: { userId: true } });
    if (!list) throw new NotFoundException('Lista não encontrada');
    if (list.userId !== userId) throw new ForbiddenException('Essa lista não é sua');
  }
}
