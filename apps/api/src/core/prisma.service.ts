import { Injectable, OnModuleDestroy } from '@nestjs/common';
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
  // Sem `pgbouncer=true`: o pooler do Prisma Postgres (PgBouncer recente) já trata prepared statements.
  // Com a opção, o Prisma embrulha cada consulta em BEGIN/DEALLOCATE/COMMIT (~4x mais idas ao banco)
  // e, em partidas a frio, conexões ficaram presas em "idle in transaction", esgotando o pool.
  url.searchParams.delete('pgbouncer');
  // Poucas conexões por instância: o pooler é quem distribui entre as instâncias.
  if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '5');
  return url.toString();
}

/**
 * Sem `$connect()` na inicialização: o Prisma conecta sozinho na primeira consulta e tenta de novo
 * nas seguintes se falhar. Assim, uma falha momentânea do banco derruba só aquela requisição
 * (503, ver DatabaseUnavailableFilter) em vez da subida inteira da instância.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const url = runtimeUrl();
    super(url ? { datasourceUrl: url } : undefined);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
