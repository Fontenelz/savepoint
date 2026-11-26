import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType, z } from 'zod';

/** Valida body/query com os mesmos schemas Zod usados no front (@savepoint/shared). */
export class ZodPipe<T extends ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      const first = result.error.issues[0];
      throw new BadRequestException({
        message: first?.message ?? 'Dados inválidos',
        issues: result.error.flatten().fieldErrors,
      });
    }
    return result.data;
  }
}
