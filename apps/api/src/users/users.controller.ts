import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  libraryQuerySchema,
  pageQuerySchema,
  updateProfileSchema,
  type LibraryQuery,
  type UpdateProfileInput,
} from '@savepoint/shared';
import { Auth, CurrentUser, OptionalAuth, type AuthUser } from '../auth/auth.guard';
import { ZodPipe } from '../core/zod.pipe';
import { UsersService } from './users.service';

const pageQuery = new ZodPipe(pageQuerySchema);

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('feed')
  @Auth()
  feed(@Query(pageQuery) query: { page: number }, @CurrentUser() user: AuthUser) {
    return this.users.feed(user.id, query.page);
  }

  @Get('me/suggestions')
  @Auth()
  suggestions(@CurrentUser() user: AuthUser) {
    return this.users.suggestions(user.id);
  }

  @Patch('me')
  @Auth()
  updateMe(@Body(new ZodPipe(updateProfileSchema)) body: UpdateProfileInput, @CurrentUser() user: AuthUser) {
    return this.users.updateProfile(user.id, body);
  }

  @Get('users/:username')
  @OptionalAuth()
  profile(@Param('username') username: string, @CurrentUser() user?: AuthUser) {
    return this.users.profile(username, user?.id);
  }

  @Get('users/:username/games')
  library(@Param('username') username: string, @Query(new ZodPipe(libraryQuerySchema)) query: LibraryQuery) {
    return this.users.library(username, query);
  }

  @Get('users/:username/diary')
  @OptionalAuth()
  diary(@Param('username') username: string, @Query(pageQuery) query: { page: number }, @CurrentUser() user?: AuthUser) {
    return this.users.diary(username, query.page, user?.id);
  }

  @Get('users/:username/reviews')
  @OptionalAuth()
  reviews(@Param('username') username: string, @Query(pageQuery) query: { page: number }, @CurrentUser() user?: AuthUser) {
    return this.users.reviews(username, query.page, user?.id);
  }

  @Get('users/:username/lists')
  lists(@Param('username') username: string) {
    return this.users.lists(username);
  }

  @Post('users/:username/follow')
  @Auth()
  follow(@Param('username') username: string, @CurrentUser() user: AuthUser) {
    return this.users.follow(user.id, username, true);
  }

  @Delete('users/:username/follow')
  @Auth()
  unfollow(@Param('username') username: string, @CurrentUser() user: AuthUser) {
    return this.users.follow(user.id, username, false);
  }
}
