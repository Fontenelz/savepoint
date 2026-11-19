import { Global, Module } from '@nestjs/common';
import { HttpCacheService } from './http-cache.service';
import { MediaService } from './media.service';
import { PrismaService } from './prisma.service';
import { StatsService } from './stats.service';

@Global()
@Module({
  providers: [PrismaService, StatsService, MediaService, HttpCacheService],
  exports: [PrismaService, StatsService, MediaService, HttpCacheService],
})
export class CoreModule {}
