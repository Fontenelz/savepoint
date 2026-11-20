import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { CoreModule } from './core/core.module';
import { GamesModule } from './games/games.module';
import { LibraryModule } from './library/library.module';
import { ListsModule } from './lists/lists.module';
import { LogsModule } from './logs/logs.module';
import { SteamModule } from './steam/steam.module';
import { UsersModule } from './users/users.module';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { ok: true };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CoreModule,
    AuthModule,
    GamesModule,
    LibraryModule,
    LogsModule,
    ListsModule,
    UsersModule,
    CatalogModule,
    SteamModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
