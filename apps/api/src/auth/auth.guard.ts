import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
  applyDecorators,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

export interface AuthUser {
  id: string;
  username: string;
}

interface RequestWithUser {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
}

const OPTIONAL_AUTH = 'optional-auth';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    const header = req.headers.authorization;
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null;

    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string; username: string }>(token);
        req.user = { id: payload.sub, username: payload.username };
        return true;
      } catch {
        if (!optional) throw new UnauthorizedException('Sessão expirada, entre novamente');
      }
    }

    if (optional) return true;
    throw new UnauthorizedException('Entre na sua conta para continuar');
  }
}

/** Rota exige login. */
export const Auth = () => UseGuards(AuthGuard);

/** Rota funciona sem login, mas reconhece o usuário quando há token. */
export const OptionalAuth = () => applyDecorators(SetMetadata(OPTIONAL_AUTH, true), UseGuards(AuthGuard));

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<RequestWithUser>().user;
});
