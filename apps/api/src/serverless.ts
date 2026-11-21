import type { IncomingMessage, ServerResponse } from 'node:http';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { waitUntil } from '@vercel/functions';
import { createApp } from './app.factory';
import { POOL_IDLE_MS } from './core/prisma.service';

/**
 * Porta de entrada da API como função serverless (Vercel).
 * O app é criado uma única vez por instância e reaproveitado entre requisições
 * (com Fluid compute, a mesma instância atende várias requisições).
 */
let ready: Promise<NestFastifyApplication> | null = null;

function getApp() {
  ready ??= createApp().then(async (app) => {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    return app;
  });
  return ready;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Segura a instância um pouco depois da resposta para o pool fechar as conexões ociosas antes da
  // suspensão do Fluid compute (ver PrismaService). Chamado aqui porque é onde o contexto da
  // requisição da Vercel existe com certeza; fora da Vercel o waitUntil não faz nada.
  waitUntil(
    new Promise<void>((resolve) => res.once('close', () => setTimeout(resolve, POOL_IDLE_MS + 100))),
  );
  try {
    const app = await getApp();
    app.getHttpAdapter().getInstance().server.emit('request', req, res);
  } catch (e) {
    ready = null; // falha na inicialização: tenta de novo na próxima requisição
    console.error(e);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ statusCode: 500, message: 'Falha ao iniciar a API' }));
  }
}
