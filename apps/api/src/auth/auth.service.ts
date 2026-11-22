import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponse, GoogleAuthResponse, LoginInput, RegisterInput, Viewer } from '@savepoint/shared';
import { compare, hash } from 'bcryptjs';
import { applyAccountProfile } from '../core/account-profile';
import { PrismaService } from '../core/prisma.service';
import { GoogleAuthService } from './google.service';

/** Proteção contra força bruta: 8 senhas erradas por conta a cada 15 minutos. */
const MAX_FAILURES = 8;
const WINDOW_MS = 15 * 60 * 1000;

const viewerSelect = { id: true, username: true, displayName: true, avatarHue: true, avatarUrl: true, email: true };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly google: GoogleAuthService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username: input.username }, { email: input.email }] },
      select: { username: true },
    });
    if (existing) {
      throw new ConflictException(
        existing.username === input.username ? 'Esse nome de usuário já existe' : 'Esse e-mail já está cadastrado',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        displayName: input.displayName,
        passwordHash: await hash(input.password, 10),
        avatarHue: Math.floor(Math.random() * 360),
      },
      select: viewerSelect,
    });
    return this.issue(user);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const key = `login:${input.login}`;
    await this.assertNotThrottled(key);

    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: input.login }, { email: input.login }] },
      select: { ...viewerSelect, passwordHash: true },
    });
    // Conta criada pelo Google não tem senha: mesma resposta de senha errada (não revela nada).
    if (!user?.passwordHash || !(await compare(input.password, user.passwordHash))) {
      await this.registerFailure(key);
      throw new UnauthorizedException('Usuário ou senha incorretos');
    }
    await this.prisma.loginThrottle.deleteMany({ where: { key } });
    const { passwordHash: _, ...viewer } = user;
    return this.issue(viewer);
  }

  /**
   * Login com Google: entra na conta ligada ao Google; senão, liga à conta com o mesmo
   * e-mail (verificado pelo Google); senão, cria uma conta nova.
   * Nome e foto do Google são guardados a cada login (foto/nome exibidos: ver applyAccountProfile).
   */
  async loginWithGoogle(code: string, redirectUri: string): Promise<GoogleAuthResponse> {
    const profile = await this.google.profileFromCode(code, redirectUri);
    const googleData = { googleId: profile.googleId, googleName: profile.name, googleAvatar: profile.picture };

    const linked = await this.prisma.user.findUnique({ where: { googleId: profile.googleId }, select: { id: true } });
    const byEmail = linked
      ? null
      : await this.prisma.user.findUnique({ where: { email: profile.email }, select: { id: true } });
    const existing = linked ?? byEmail;

    let userId: string;
    if (existing) {
      await this.prisma.user.update({ where: { id: existing.id }, data: googleData });
      userId = existing.id;
    } else {
      const created = await this.prisma.user.create({
        data: {
          username: await this.google.uniqueUsername(profile.email),
          email: profile.email,
          displayName: profile.name,
          avatarHue: Math.floor(Math.random() * 360),
          ...googleData,
        },
        select: { id: true },
      });
      userId = created.id;
    }
    await applyAccountProfile(this.prisma, userId);
    return { ...(await this.sessionFor(userId)), created: !existing };
  }

  /** Sessão (token + dados do usuário) para uma conta já autenticada por outro meio (Google, Steam). */
  async sessionFor(userId: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: viewerSelect });
    return this.issue(user);
  }

  async me(userId: string): Promise<Viewer> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ...viewerSelect, steamId: true, googleId: true },
    });
    if (!row) throw new NotFoundException('Usuário não encontrado');
    const { steamId, googleId, ...user } = row;
    return { ...user, steamLinked: Boolean(steamId), googleLinked: Boolean(googleId) };
  }

  private async assertNotThrottled(key: string) {
    const t = await this.prisma.loginThrottle.findUnique({ where: { key } });
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
    const t = await this.prisma.loginThrottle.findUnique({ where: { key } });
    const expired = !t || now.getTime() - t.windowStart.getTime() > WINDOW_MS;
    await this.prisma.loginThrottle.upsert({
      where: { key },
      create: { key, failures: 1, windowStart: now },
      update: expired ? { failures: 1, windowStart: now } : { failures: { increment: 1 } },
    });
  }

  private async issue(user: Viewer): Promise<AuthResponse> {
    const token = await this.jwt.signAsync({ sub: user.id, username: user.username });
    return { token, user };
  }
}
