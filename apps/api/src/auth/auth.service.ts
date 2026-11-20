import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { or } from '@prisma/orm-postgres/orm-client';
import type { AuthResponse, LoginInput, RegisterInput, Viewer } from '@savepoint/shared';
import { compare, hash } from 'bcryptjs';
import { jwtSecret, db } from '../core/runtime';
import { PrismaService } from '../core/prisma.service';

/** Proteção contra força bruta: 8 senhas erradas por conta a cada 15 minutos. */
const MAX_FAILURES = 8;
const WINDOW_MS = 15 * 60 * 1000;

const viewerFields = ['id', 'username', 'displayName', 'avatarHue', 'email'] as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await db.orm.public.User
      .where((u) => or(u.username.eq(input.username), u.email.eq(input.email)))
      .select('username')
      .first();
    if (existing) {
      throw new ConflictException(
        existing.username === input.username ? 'Esse nome de usuário já existe' : 'Esse e-mail já está cadastrado',
      );
    }

    const user = await db.orm.public.User.select(...viewerFields).create({
      username: input.username,
      email: input.email,
      displayName: input.displayName,
      passwordHash: await hash(input.password, 10),
      avatarHue: Math.floor(Math.random() * 360),
    });
    return this.issue(user);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const key = `login:${input.login}`;
    await this.assertNotThrottled(key);

    const user = await db.orm.public.User
      .where((u) => or(u.username.eq(input.login), u.email.eq(input.login)))
      .select(...viewerFields, 'passwordHash')
      .first();
    if (!user || !(await compare(input.password, user.passwordHash))) {
      await this.registerFailure(key);
      throw new UnauthorizedException('Usuário ou senha incorretos');
    }
    await db.orm.public.LoginThrottle.where({ key }).deleteAll();
    const { passwordHash: _, ...viewer } = user;
    return this.issue(viewer);
  }

  async me(userId: string): Promise<Viewer> {
    const user = await db.orm.public.User.select(...viewerFields).first({ id: userId });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  private async assertNotThrottled(key: string) {
    const t = await db.orm.public.LoginThrottle.where({ key }).first();
    if (!t || t.failures < MAX_FAILURES) return;
    const remaining = t.windowStart.getTime() + WINDOW_MS - Date.now();
    if (remaining <= 0) return; // janela venceu: registerFailure reinicia a contagem
    const minutes = Math.ceil(remaining / 60000);
    throw new HttpException(
      `Muitas tentativas de login. Tente de novo em ${minutes} minuto${minutes > 1 ? 's' : ''}.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async registerFailure(key: string) {
    const now = new Date();
    const t = await db.orm.public.LoginThrottle.where({ key }).first();
    const expired = !t || now.getTime() - t.windowStart.getTime() > WINDOW_MS;
    await db.orm.public.LoginThrottle.upsert({
      create: { key, failures: 1, windowStart: now },
      update: expired ? { failures: 1, windowStart: now } : { failures: (t?.failures ?? 0) + 1 },
      conflictOn: { key },
    });
  }

  private async issue(user: Viewer): Promise<AuthResponse> {
    const token = await this.jwt.signAsync({ sub: user.id, username: user.username });
    return { token, user };
  }
}
