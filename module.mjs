// @ts-check
import { module } from '@prisma/composer';
import { envSecret, serviceOrigin } from '@prisma/composer-prisma-cloud';
import { postgres, dataContract } from '@prisma/composer-prisma-cloud/orm';
import apiContractJson from './apps/api/src/prisma/contract.json' with { type: 'json' };
import apiService from './apps/api/src/service.mts';
import webService from './apps/web/service.mjs';

export default module('savepoint', ({ provision }) => {
  const database = provision(
    postgres({ name: 'database', contract: dataContract(apiContractJson), config: './apps/api/prisma.config.ts' }),
  );
  const api = provision(apiService, {
    deps: { db: database },
    input: {
      jwtSecret: envSecret('JWT_SECRET'), // Assina os tokens de sessão (JWT) da API.
      webOrigin: serviceOrigin('savepoint.web'), // Origem pública do site, para o CORS da API.
      igdbClientId: envSecret('IGDB_CLIENT_ID'), // IGDB (Twitch): importação de jogos.
      igdbClientSecret: envSecret('IGDB_CLIENT_SECRET'), // IGDB (Twitch): importação de jogos.
      blobToken: envSecret('BLOB_READ_WRITE_TOKEN'), // Vercel Blob: armazenamento das capas.
    },
  });
  provision(webService, { deps: { api: api.http } });
});
