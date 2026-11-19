import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { createGameSchema, gameQuerySchema, type CreateGameInput, type GameQuery } from '@savepoint/shared';
import { z } from 'zod';
import { Auth, CurrentUser, OptionalAuth, type AuthUser } from '../auth/auth.guard';
import { ZodPipe } from '../core/zod.pipe';
import { GamesService } from './games.service';

@Controller()
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get('home')
  @OptionalAuth()
  home(@CurrentUser() user?: AuthUser) {
    return this.games.home(user?.id);
  }

  @Get('meta')
  meta() {
    return this.games.meta();
  }

  @Get('games')
  list(@Query(new ZodPipe(gameQuerySchema)) query: GameQuery) {
    return this.games.list(query);
  }

  @Get('games/search')
  search(@Query(new ZodPipe(z.object({ q: z.string().trim().min(1).max(100) }))) query: { q: string }) {
    return this.games.searchLite(query.q);
  }

  @Get('games/:slug')
  @OptionalAuth()
  detail(@Param('slug') slug: string, @CurrentUser() user?: AuthUser) {
    return this.games.detail(slug, user?.id);
  }

  /** Cadastro colaborativo (estilo Skoob): o catálogo não depende de API externa. */
  @Post('games')
  @Auth()
  create(@Body(new ZodPipe(createGameSchema)) body: CreateGameInput, @CurrentUser() user: AuthUser) {
    return this.games.create(body, user.id);
  }

  @Delete('games/:slug')
  @Auth()
  remove(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    return this.games.remove(slug, user.id);
  }
}
