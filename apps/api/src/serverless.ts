import type { IncomingMessage, ServerResponse } from 'node:http';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from './app.factory';

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
