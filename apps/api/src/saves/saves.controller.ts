import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { commentSchema, replaySchema, saveReviewSchema, type CommentInput } from '@savepoint/shared';
import type { z } from 'zod';
import { Auth, CurrentUser, OptionalAuth, type AuthUser } from '../auth/auth.guard';
import { ZodPipe } from '../core/zod.pipe';
import { SavesService } from './saves.service';

/** Saves (jornadas): rejogar, avaliar (nota + review), curtidas e respostas das reviews. */
@Controller('saves')
export class SavesController {
  constructor(private readonly saves: SavesService) {}

  /** POST /saves/replay — abre um save novo para um jogo fechado. */
  @Post('replay')
  @Auth()
  replay(@Body(new ZodPipe(replaySchema)) body: z.infer<typeof replaySchema>, @CurrentUser() user: AuthUser) {
    return this.saves.replay(user.id, body.gameId);
  }

  @Delete('comments/:commentId')
  @Auth()
  removeComment(@Param('commentId') commentId: string, @CurrentUser() user: AuthUser) {
    return this.saves.removeComment(user.id, commentId);
  }

  @Get(':id')
  @OptionalAuth()
  get(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.saves.get(id, user?.id);
  }

  /** PUT /saves/:id/review — nota + review do save (fechado ou "Sem fim"). */
  @Put(':id/review')
  @Auth()
  review(
    @Param('id') id: string,
    @Body(new ZodPipe(saveReviewSchema)) body: z.output<typeof saveReviewSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.saves.review(user.id, id, body);
  }

  @Post(':id/like')
  @Auth()
  like(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.saves.toggleLike(user.id, id);
  }

  @Get(':id/comments')
  @OptionalAuth()
  comments(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.saves.comments(id, user?.id);
  }

  @Post(':id/comments')
  @Auth()
  addComment(@Param('id') id: string, @Body(new ZodPipe(commentSchema)) body: CommentInput, @CurrentUser() user: AuthUser) {
    return this.saves.addComment(user.id, id, body.body);
  }
}
