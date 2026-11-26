import { Global, Module } from '@nestjs/common';
import { HttpCacheService } from './http-cache.service';
import { MediaService } from './media.service';
import { PrismaService } from './prisma.service';
import { JourneyService } from './journey.service';
import { StatsService } from './stats.service';

@Global()
@Module({
  providers: [PrismaService, StatsService, JourneyService, MediaService, HttpCacheService],
  exports: [PrismaService, StatsService, JourneyService, MediaService, HttpCacheService],
})
export class CoreModule {}
