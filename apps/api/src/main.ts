import { createApp } from './app.factory';

/** Servidor local (desenvolvimento, Docker ou qualquer servidor sempre ligado). */
async function bootstrap() {
  const app = await createApp();
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port, '0.0.0.0');
  console.log(`🎮 Savepoint API em http://localhost:${port}/api`);
}

bootstrap();
