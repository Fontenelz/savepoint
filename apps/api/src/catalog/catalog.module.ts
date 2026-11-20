import { Module } from '@nestjs/common';
import { GamesModule } from '../games/games.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogDetailsService } from './details.service';
import { ARTWORK_SOURCES } from './providers/artwork-source';
import { CATALOG_PROVIDERS } from './providers/catalog-provider';
import { IgdbProvider } from './providers/igdb.provider';
import { SteamStoreClient } from './providers/steam-store.client';
import { WikiSteamSource } from './providers/wiki-steam.source';

@Module({
  imports: [GamesModule],
  controllers: [CatalogController],
  providers: [
    CatalogService,
    CatalogDetailsService,
    IgdbProvider,
    SteamStoreClient,
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
  exports: [CatalogService, CatalogDetailsService, SteamStoreClient],
})
export class CatalogModule {}
