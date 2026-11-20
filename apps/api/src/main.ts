import { createApp } from './app.factory';
import service from './service.mjs';

/** Servidor da API: a porta vem do serviço do Composer, em toda interface. */
async function bootstrap() {
  const app = await createApp();
  app.enableShutdownHooks();

  const port = service.port();
  await app.listen(port, '0.0.0.0');
  console.log(`🎮 Savepoint API em http://localhost:${port}/api`);
}

bootstrap();
