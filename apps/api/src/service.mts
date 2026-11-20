import { type } from 'arktype';
import node from '@prisma/composer/node';
import { field, secretString } from '@prisma/composer/arktype';
import { rawHttpContract } from '@prisma/composer/http';
import { compute } from '@prisma/composer-prisma-cloud';
import { postgres, dataContract } from '@prisma/composer-prisma-cloud/orm';
import type { Contract } from './prisma/contract.js';
import apiContractJson from './prisma/contract.json' with { type: 'json' };

/**
 * Declaração do serviço da API para o Prisma Compute/Composer.
 * O banco chega como dependência (`service.load().db`) — nunca de DATABASE_URL —
 * e os segredos como input (`service.input()`), nunca de process.env.
 */
export default compute({
  name: 'api',
  deps: { db: postgres(dataContract<Contract>(apiContractJson)) },
  input: type({
    jwtSecret: secretString(), // Assina os tokens de sessão (JWT).
    webOrigin: field(type('string')), // Origem pública do site (CORS).
    igdbClientId: secretString().optional(), // IGDB (Twitch): importação de jogos.
    igdbClientSecret: secretString().optional(), // IGDB (Twitch): importação de jogos.
    blobToken: secretString().optional(), // Vercel Blob: armazenamento das capas.
  }),
  build: node({ module: import.meta.url, dir: '../dist', entry: 'main.js', dependencies: 'external' }),
  expose: { http: rawHttpContract },
});
