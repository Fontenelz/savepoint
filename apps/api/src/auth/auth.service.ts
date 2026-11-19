import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponse, LoginInput, RegisterInput, Viewer } from '@savepoint/shared';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../core/prisma.service';

const viewerSelect = { id: true, username: true, displayName: true, avatarHue: true, email: true };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
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
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: input.login }, { email: input.login }] },
      select: { ...viewerSelect, passwordHash: true },
    });
    if (!user || !(await compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Usuário ou senha incorretos');
    }
    const { passwordHash: _, ...viewer } = user;
    return this.issue(viewer);
  }

  async me(userId: string): Promise<Viewer> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: viewerSelect });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  private async issue(user: Viewer): Promise<AuthResponse> {
    const token = await this.jwt.signAsync({ sub: user.id, username: user.username });
    return { token, user };
  }
}
