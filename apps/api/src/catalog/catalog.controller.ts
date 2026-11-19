import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { catalogImportSchema, catalogSearchSchema } from '@savepoint/shared';
import { Auth, CurrentUser, type AuthUser } from '../auth/auth.guard';
import { ZodPipe } from '../core/zod.pipe';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('status')
  status() {
    return this.catalog.status();
  }

  @Get('search')
  @Auth()
  search(@Query(new ZodPipe(catalogSearchSchema)) query: { q: string }) {
    return this.catalog.search(query.q);
  }

  @Post('import')
  @Auth()
  import(@Body(new ZodPipe(catalogImportSchema)) body: { externalId: string }, @CurrentUser() user: AuthUser) {
    return this.catalog.import(body.externalId, user.id);
  }

  /** Busca capa/banner para um jogo (usado logo após o cadastro manual). */
  @Post('games/:slug/artwork')
  @Auth()
  artwork(@Param('slug') slug: string) {
    return this.catalog.enrichGame(slug);
  }
}
