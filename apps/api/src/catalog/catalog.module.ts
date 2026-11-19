import { Module } from '@nestjs/common';
import { GamesModule } from '../games/games.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ARTWORK_SOURCES } from './providers/artwork-source';
import { CATALOG_PROVIDERS } from './providers/catalog-provider';
import { IgdbProvider } from './providers/igdb.provider';
import { WikiSteamSource } from './providers/wiki-steam.source';

@Module({
  imports: [GamesModule],
  controllers: [CatalogController],
  providers: [
    CatalogService,
    IgdbProvider,
    WikiSteamSource,
    // Importação de jogos completos (busca + cadastro).
    { provide: CATALOG_PROVIDERS, useFactory: (igdb: IgdbProvider) => [igdb], inject: [IgdbProvider] },
    // Fontes de arte, em ordem de prioridade: IGDB (se configurado) → Wikipedia + Steam (sem chave).
    {
      provide: ARTWORK_SOURCES,
      useFactory: (igdb: IgdbProvider, wiki: WikiSteamSource) => [igdb, wiki],
      inject: [IgdbProvider, WikiSteamSource],
    },
  ],
  exports: [CatalogService],
})
export class CatalogModule {}
