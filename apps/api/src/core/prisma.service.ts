import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { attachDatabasePool } from '@vercel/functions';
import { Pool } from 'pg';

/**
 * Em produção (funções serverless) a API usa o pooler do Prisma Postgres (DATABASE_URL_POOLED).
 * Sem ele, cada instância da função abre e mantém as próprias conexões diretas — com várias
 * instâncias (e regiões) o banco recusa novas conexões ("Too many database connections").
 * As migrations do build continuam na conexão direta (DATABASE_URL), como devem.
 */
function connectionString(): string {
  const raw = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL não definida');
  const url = new URL(raw);
  // Parâmetros do motor antigo do Prisma; o driver `pg` não os usa (o pool é configurado abaixo).
  for (const p of ['pgbouncer', 'connection_limit', 'pool_timeout', 'schema']) url.searchParams.delete(p);
  return url.toString();
}

const logger = new Logger('PrismaService');

/**
 * Pool do driver `pg` (via driver adapter) em vez do pool interno do motor do Prisma.
 *
 * Motivo: na Vercel (Fluid compute) a instância é suspensa entre pedidos e os timeouts de conexão
 * ociosa não rodam durante a suspensão. Com o pool interno, instâncias que ficavam alguns minutos
 * paradas voltavam com as conexões travadas ("Timed out fetching a new connection from the
 * connection pool", P2024) até serem descartadas. `attachDatabasePool` mantém a instância viva só
 * o bastante para fechar as conexões ociosas antes da suspensão (fora da Vercel não faz nada).
 * Guia: https://vercel.com/kb/guide/efficiently-manage-database-connection-pools-with-fluid-compute
 *
 * O pool conecta só na primeira consulta: uma falha momentânea do banco derruba aquela requisição
 * (503, ver DatabaseUnavailableFilter), não a subida da instância.
 */
function createPool(): Pool {
  const pool = new Pool({
    connectionString: connectionString(),
    max: 5, // poucas por instância: o pooler distribui entre as instâncias
    idleTimeoutMillis: 5_000, // fecha logo o que ficou ocioso (recomendação da Vercel)
    connectionTimeoutMillis: 10_000, // o padrão do pg é esperar para sempre
  });
  // Conexão ociosa que cai (ex.: pooler encerrou) emite 'error' no pool; sem listener, derruba o processo.
  pool.on('error', (e) => logger.warn(`Conexão ociosa do pool caiu: ${e.message}`));
  attachDatabasePool(pool);
  return pool;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg(createPool()) });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
