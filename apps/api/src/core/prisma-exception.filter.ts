import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';

/**
 * O ORM 8 reporta falhas de consulta como erros `sql_query` (classe
 * `SqlQueryError`, que o pacote não exporta publicamente). Casamos pelo
 * `kind` via `Symbol.hasInstance`, que é o que o `instanceof` do Nest usa.
 */
class SqlQueryErrorShape {}

Object.defineProperty(SqlQueryErrorShape, Symbol.hasInstance, {
  value: (error: unknown) =>
    typeof error === 'object' && error !== null && (error as { kind?: string }).kind === 'sql_query',
});

interface SqlQueryErrorLike {
  sqlState?: string;
  constraint?: string;
  table?: string;
  message: string;
}

/**
 * Traduz erros conhecidos do banco em respostas HTTP corretas,
 * em vez de deixá-los virar 500 genérico.
 */
@Catch(SqlQueryErrorShape)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(error: SqlQueryErrorLike, host: ArgumentsHost) {
    const reply = host.switchToHttp().getResponse<{ status(code: number): { send(body: unknown): void } }>();
    const map: Record<string, [number, string]> = {
      // 23505: unique_violation (era P2002); 23503: foreign_key_violation (era P2003).
      '23505': [HttpStatus.CONFLICT, 'Esse registro já existe'],
      '23503': [HttpStatus.BAD_REQUEST, 'Referência inválida: algum item informado não existe'],
    };
    const [status, message] = map[error.sqlState ?? ''] ?? [HttpStatus.INTERNAL_SERVER_ERROR, 'Erro interno'];
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) this.logger.error(error);
    reply.status(status).send({ statusCode: status, message });
  }
}
