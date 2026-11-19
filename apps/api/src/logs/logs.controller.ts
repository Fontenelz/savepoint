import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { logEntrySchema } from '@savepoint/shared';
import type { z } from 'zod';
import { Auth, CurrentUser, OptionalAuth, type AuthUser } from '../auth/auth.guard';
import { ZodPipe } from '../core/zod.pipe';
import { LogsService } from './logs.service';

@Controller('logs')
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Post()
  @Auth()
  create(@Body(new ZodPipe(logEntrySchema)) body: z.output<typeof logEntrySchema>, @CurrentUser() user: AuthUser) {
    return this.logs.create(user.id, body);
  }

  @Get(':id')
  @OptionalAuth()
  get(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.logs.get(id, user?.id);
  }

  @Delete(':id')
  @Auth()
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.logs.remove(user.id, id);
  }

  @Post(':id/like')
  @Auth()
  like(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.logs.toggleLike(user.id, id);
  }
}
