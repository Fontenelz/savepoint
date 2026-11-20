import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { mkdirSync } from 'node:fs';
import { AppModule } from './app.module';
import { MediaService } from './core/media.service';
import { PrismaExceptionFilter } from './core/prisma-exception.filter';

/**
 * Cria e configura o app Nest. Usado tanto pelo servidor local (main.ts)
 * quanto pela função serverless da Vercel (serverless.ts).
 */
export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: process.env.VERCEL ? ['error', 'warn', 'log'] : undefined,
  });

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
  });

  // Armazenamento local: as imagens ficam em disco e a API as serve em /media/*.
  // No Vercel Blob as imagens têm URL pública própria e nada é servido aqui.
  const media = app.get(MediaService);
  if (media.driver === 'local') {
    mkdirSync(media.root, { recursive: true });
    app.useStaticAssets({ root: media.root, prefix: '/media/', maxAge: '7d', decorateReply: false });
  }

  return app;
}
