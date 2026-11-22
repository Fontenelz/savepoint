import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

/** Conexão ociosa do pool é fechada depois deste tempo (também usado em `serverless.ts`). */
export const POOL_IDLE_MS = 5_000;

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
 * connection pool", P2024) até serem descartadas. O handler serverless (`serverless.ts`) mantém a
 * instância viva por POOL_IDLE_MS depois de cada resposta, para o `pg` fechar as conexões ociosas
 * antes da suspensão. Guia: https://vercel.com/kb/guide/efficiently-manage-database-connection-pools-with-fluid-compute
 *
 * Não usamos `attachDatabasePool` (@vercel/functions): ele pega o contexto da requisição no
 * `pool.connect()`, mas o motor do Prisma chama o adapter por callbacks nativos, fora do
 * AsyncLocalStorage — o contexto chega vazio e ele só loga "Pool release event triggered outside
 * of request scope." sem segurar a instância (verificado em produção e reproduzido localmente).
 *
 * O pool conecta só na primeira consulta: uma falha momentânea do banco derruba aquela requisição
 * (503, ver DatabaseUnavailableFilter), não a subida da instância.
 */
function createPool(): Pool {
  const pool = new Pool({
    connectionString: connectionString(),
    max: 5, // poucas por instância: o pooler distribui entre as instâncias
    idleTimeoutMillis: POOL_IDLE_MS, // fecha logo o que ficou ocioso (recomendação da Vercel)
    connectionTimeoutMillis: 10_000, // o padrão do pg é esperar para sempre
    // Consulta sem resposta vira erro (→ 503) em vez de prender a função até o limite de 30 s.
    // O pg descarta a conexão que estourou o tempo (Pool.query libera o cliente com erro).
    query_timeout: QUERY_TIMEOUT_MS,
  });
  // Conexão ociosa que cai (ex.: pooler encerrou) emite 'error' no pool; sem listener, derruba o processo.
  pool.on('error', (e) => logger.warn(`Conexão ociosa do pool caiu: ${e.message}`));
  instrument(pool);
  return pool;
}

/** Consulta mais lenta que isto é logada (inclusive enquanto ainda está em andamento). */
const SLOW_MS = 3_000;
const QUERY_TIMEOUT_MS = 10_000;

/**
 * Diagnóstico das travadas em produção: em instâncias novas, às vezes uma consulta chega ao banco e
 * as seguintes não, e a função estoura 30 s. Loga, só quando algo passa de SLOW_MS ou falha:
 * quanto tempo levou para obter uma conexão do pool, quanto a consulta levou e o estado do pool.
 * O aviso "em andamento" sai por timer, então aparece mesmo se a consulta nunca terminar.
 */
function instrument(pool: Pool, { neon = false } = {}) {
  const state = () => `pool total=${pool.totalCount} livres=${pool.idleCount} esperando=${pool.waitingCount}`;
  let opened = 0;
  pool.on('connect', () => {
    opened++;
  });

  const connect = pool.connect.bind(pool) as (cb: (...a: unknown[]) => void) => void;
  // Pool.query chama this.connect(callback) por dentro, então isto mede a espera por conexão.
  (pool as unknown as { connect: unknown }).connect = (cb?: (...a: unknown[]) => void) => {
    const start = Date.now();
    const before = opened;
    const timer = setTimeout(() => logger.warn(`pool.connect em andamento há ${SLOW_MS} ms (${state()})`), SLOW_MS);
    const report = (err: unknown) => {
      clearTimeout(timer);
      const ms = Date.now() - start;
      const kind = opened > before ? 'conexão nova' : 'conexão reaproveitada';
      if (err) logger.warn(`pool.connect falhou em ${ms} ms: ${(err as Error).message} (${state()})`);
      else if (ms >= SLOW_MS) logger.warn(`pool.connect levou ${ms} ms (${kind}; ${state()})`);
    };
    if (cb) return connect((err, ...rest) => (report(err), cb(err, ...rest)));
    return new Promise((resolve, reject) =>
      connect((err, client) => (report(err), err ? reject(err) : resolve(client))),
    );
  };

  const query = pool.query.bind(pool) as (...a: unknown[]) => Promise<unknown>;
  (pool as unknown as { query: unknown }).query = (config: unknown, values?: unknown) => {
    const text = typeof config === 'string' ? config : ((config as { text?: string })?.text ?? '');
    const sql = text.replace(/\s+/g, ' ').slice(0, 80);
    const start = Date.now();
    const timer = setTimeout(() => logger.warn(`consulta em andamento há ${SLOW_MS} ms: ${sql} (${state()})`), SLOW_MS);
    return query(config, values).then(
      (r) => {
        clearTimeout(timer);
        const ms = Date.now() - start;
        if (ms >= SLOW_MS) logger.warn(`consulta levou ${ms} ms: ${sql} (${state()})`);
        return r;
      },
      (e: Error & { code?: string }) => {
        clearTimeout(timer);
        logger.warn(`consulta falhou em ${Date.now() - start} ms: ${e.message} — ${sql} (${state()})`);
        // O query_timeout do pg vem sem código; com ETIMEDOUT o adapter do Prisma o trata como
        // timeout de socket (erro conhecido → 503 no PrismaExceptionFilter) em vez de erro genérico.
        if (e.message === 'Query read timeout' && !e.code) {
          e.code = 'ETIMEDOUT';
          // O adapter do Neon só converte erros com cara de erro do Postgres (exige `severity`); sem
          // isto o erro chega cru. Só no Neon: no pg o caminho que já funciona (→ 503) fica igual.
          if (neon) (e as { severity?: string }).severity ??= 'ERROR';
        }
        throw e;
      },
    );
  };
}

/**
 * Driver do banco, escolhido por `DB_DRIVER`:
 * - `pg` (padrão): TCP direto no Postgres/pooler, com o pool instrumentado acima.
 * - `neon`: driver serverless do Neon (`@neondatabase/serverless`), que fala com o banco por
 *   WebSocket na porta 443 (proxy do Neon) em vez de TCP 5432. Suporta transações, ao contrário do
 *   modo HTTP. Usa o WebSocket nativo do Node (22+). Teste para as consultas que ficam sem resposta
 *   no pooler do Prisma Postgres — ver o PR.
 */
function createAdapter() {
  const driver = process.env.DB_DRIVER ?? 'pg';
  if (driver === 'pg') return new PrismaPg(createPool());
  if (driver !== 'neon') throw new Error(`DB_DRIVER inválido: ${driver} (use pg ou neon)`);
  logger.log('Driver do banco: neon (WebSocket)');
  const factory = new PrismaNeon(
    {
      connectionString: connectionString(),
      max: 5,
      idleTimeoutMillis: POOL_IDLE_MS,
      connectionTimeoutMillis: 10_000,
      query_timeout: QUERY_TIMEOUT_MS, // mesmo motivo do pg: sem resposta vira 503, não 30 s presos
    },
    { onPoolError: (e) => logger.warn(`Conexão ociosa do pool (neon) caiu: ${e.message}`) },
  );
  // O PrismaNeon cria o pool só no connect(): envolve para aplicar a mesma instrumentação do pg.
  const connect = factory.connect.bind(factory);
  factory.connect = async () => {
    const adapter = await connect();
    instrument(adapter.underlyingDriver() as unknown as Pool, { neon: true });
    return adapter;
  };
  return factory;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: createAdapter() });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
