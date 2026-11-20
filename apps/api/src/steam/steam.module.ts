import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { GamesModule } from '../games/games.module';
import { SteamApiClient } from './steam-api.client';
import { SteamController } from './steam.controller';
import { SteamService } from './steam.service';

@Module({
  imports: [CatalogModule, GamesModule],
  controllers: [SteamController],
  providers: [SteamService, SteamApiClient],
})
export class SteamModule {}
