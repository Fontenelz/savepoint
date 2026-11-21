import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Traduz erros conhecidos do Prisma em respostas HTTP corretas,
 * em vez de deixá-los virar 500 genérico.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const reply = host.switchToHttp().getResponse<{ status(code: number): { send(body: unknown): void } }>();
    const map: Record<string, [number, string]> = {
      P2002: [HttpStatus.CONFLICT, 'Esse registro já existe'],
      P2003: [HttpStatus.BAD_REQUEST, 'Referência inválida: algum item informado não existe'],
      P2025: [HttpStatus.NOT_FOUND, 'Registro não encontrado'],
    };
    const [status, message] = map[error.code] ?? [HttpStatus.INTERNAL_SERVER_ERROR, 'Erro interno'];
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) this.logger.error(error);
    reply.status(status).send({ statusCode: status, message });
  }
}

/**
 * Banco inacessível (ex.: "Can't reach database server" ao conectar no pooler):
 * responde 503 em JSON, para o site mostrar uma mensagem clara em vez de "Erro interno".
 */
@Catch(Prisma.PrismaClientInitializationError)
export class DatabaseUnavailableFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseUnavailableFilter.name);

  catch(error: Prisma.PrismaClientInitializationError, host: ArgumentsHost) {
    const reply = host.switchToHttp().getResponse<{ status(code: number): { send(body: unknown): void } }>();
    this.logger.error(error);
    const status = HttpStatus.SERVICE_UNAVAILABLE;
    reply
      .status(status)
      .send({ statusCode: status, message: 'O banco de dados está indisponível no momento. Tente de novo.' });
  }
}
