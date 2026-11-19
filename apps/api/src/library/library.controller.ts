import { Body, Controller, Delete, Param, Post, Put } from '@nestjs/common';
import { libraryEntrySchema, type LibraryEntryInput } from '@savepoint/shared';
import { Auth, CurrentUser, type AuthUser } from '../auth/auth.guard';
import { ZodPipe } from '../core/zod.pipe';
import { LibraryService } from './library.service';

@Controller('library')
@Auth()
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

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
