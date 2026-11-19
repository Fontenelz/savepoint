import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { mkdirSync } from 'node:fs';
import { AppModule } from './app.module';
import { MediaService } from './core/media.service';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  app.enableShutdownHooks();

  // Capas/banners baixados ficam em storage/media e são servidos em /media/*
  const media = app.get(MediaService);
  mkdirSync(media.root, { recursive: true });
  app.useStaticAssets({ root: media.root, prefix: '/media/', maxAge: '7d', decorateReply: false });

  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port, '0.0.0.0');
  console.log(`🎮 Savepoint API em http://localhost:${port}/api`);
}

bootstrap();
