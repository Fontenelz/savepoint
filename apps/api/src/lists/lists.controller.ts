import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { listAddItemSchema, listSchema, pageQuerySchema } from '@savepoint/shared';
import type { z } from 'zod';
import { Auth, CurrentUser, OptionalAuth, type AuthUser } from '../auth/auth.guard';
import { ZodPipe } from '../core/zod.pipe';
import { ListsService } from './lists.service';

type ListBody = z.output<typeof listSchema>;

@Controller('lists')
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Get()
  browse(@Query(new ZodPipe(pageQuerySchema)) query: { page: number }) {
    return this.lists.browse(query.page);
  }

  @Get(':id')
  @OptionalAuth()
  get(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.lists.get(id, user?.id);
  }

  @Post()
  @Auth()
  create(@Body(new ZodPipe(listSchema)) body: ListBody, @CurrentUser() user: AuthUser) {
    return this.lists.create(user.id, body);
  }

  @Put(':id')
  @Auth()
  update(@Param('id') id: string, @Body(new ZodPipe(listSchema)) body: ListBody, @CurrentUser() user: AuthUser) {
    return this.lists.update(user.id, id, body);
  }

  @Post(':id/items')
  @Auth()
  addItem(
    @Param('id') id: string,
    @Body(new ZodPipe(listAddItemSchema)) body: { gameId: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.lists.addItem(user.id, id, body.gameId);
  }

  @Delete(':id')
  @Auth()
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lists.remove(user.id, id);
  }
}
