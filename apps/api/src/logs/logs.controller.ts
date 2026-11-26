import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { checkpointSchema } from '@savepoint/shared';
import { z } from 'zod';
import { Auth, CurrentUser, OptionalAuth, type AuthUser } from '../auth/auth.guard';
import { ZodPipe } from '../core/zod.pipe';
import { LogsService } from './logs.service';

const visibilitySchema = z.object({ isPublic: z.boolean() });

/** Checkpoints do diário. (Reviews, curtidas e respostas ficam em /saves.) */
@Controller('logs')
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Post()
  @Auth()
  create(@Body(new ZodPipe(checkpointSchema)) body: z.output<typeof checkpointSchema>, @CurrentUser() user: AuthUser) {
    return this.logs.create(user.id, body);
  }

  @Get(':id')
  @OptionalAuth()
  get(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.logs.get(id, user?.id);
  }

  @Patch(':id')
  @Auth()
  visibility(
    @Param('id') id: string,
    @Body(new ZodPipe(visibilitySchema)) body: z.infer<typeof visibilitySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.logs.setVisibility(user.id, id, body.isPublic);
  }

  @Delete(':id')
  @Auth()
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.logs.remove(user.id, id);
  }
}
