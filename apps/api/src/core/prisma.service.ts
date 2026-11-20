import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Em produção (funções serverless) a API usa o pooler do Prisma Postgres (DATABASE_URL_POOLED).
 * Sem ele, cada instância da função abre e mantém as próprias conexões diretas — com várias
 * instâncias (e regiões) o banco recusa novas conexões ("Too many database connections").
 * As migrations do build continuam na conexão direta (DATABASE_URL), como devem.
 */
function runtimeUrl(): string | undefined {
  const pooled = process.env.DATABASE_URL_POOLED;
  if (!pooled) return undefined;
  const url = new URL(pooled);
  // Poolers em modo transação não suportam prepared statements.
  url.searchParams.set('pgbouncer', 'true');
  // Poucas conexões por instância: o pooler é quem distribui entre as instâncias.
  if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '5');
  return url.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = runtimeUrl();
    super(url ? { datasourceUrl: url } : undefined);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
