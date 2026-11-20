import { Injectable } from '@nestjs/common';
import type { PostgresClient } from '@prisma/orm-postgres/runtime';
import type { Contract } from '../prisma/contract.js';
import { db } from './runtime';

/**
 * Costura o cliente Prisma ORM 8 (que vem do serviço do Composer) na injeção
 * de dependência do Nest. O pool fica com o binding do Composer, que nunca o
 * fecha — nada a desconectar aqui.
 */
@Injectable()
export class PrismaService {
  readonly client: PostgresClient<Contract> = db;

  constructor(client?: PostgresClient<Contract>) {
    if (client) this.client = client;
  }
}
