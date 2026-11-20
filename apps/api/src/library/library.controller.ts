import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { gameIdsQuerySchema, libraryEntrySchema, type LibraryEntryInput } from '@savepoint/shared';
import { Auth, CurrentUser, type AuthUser } from '../auth/auth.guard';
import { ZodPipe } from '../core/zod.pipe';
import { LibraryService } from './library.service';

@Controller('library')
@Auth()
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  /** GET /library/marks?ids=a,b,c */
  @Get('marks')
  marks(@Query(new ZodPipe(gameIdsQuerySchema)) query: { ids: string[] }, @CurrentUser() user: AuthUser) {
    return this.library.marks(user.id, query.ids);
  }

  @Put(':gameId')
  upsert(
    @Param('gameId') gameId: string,
    @Body(new ZodPipe(libraryEntrySchema)) body: LibraryEntryInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.library.upsert(user.id, gameId, body);
  }

  @Delete(':gameId')
  remove(@Param('gameId') gameId: string, @CurrentUser() user: AuthUser) {
    return this.library.remove(user.id, gameId);
  }

  @Post(':gameId/favorite')
  favorite(@Param('gameId') gameId: string, @CurrentUser() user: AuthUser) {
    return this.library.toggleFavorite(user.id, gameId);
  }
}
