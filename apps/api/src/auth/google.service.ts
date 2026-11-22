import { BadRequestException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../core/prisma.service';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
/** O site só pode pedir retorno para esta rota (o Google ainda confere a lista cadastrada no console). */
const CALLBACK_PATH = '/auth/google/callback';

interface IdTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  picture?: string;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  /** Foto da conta Google (escopo "profile"), quando houver. */
  picture: string | null;
}

/**
 * Login com Google (OAuth 2.0 / OpenID Connect, fluxo de código).
 * O navegador volta para o site com um código; a API troca o código pelo id_token
 * direto com o Google, usando o segredo do cliente, que nunca sai do servidor.
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private get clientId() {
    return this.config.get<string>('GOOGLE_CLIENT_ID') ?? '';
  }

  private get clientSecret() {
    return this.config.get<string>('GOOGLE_CLIENT_SECRET') ?? '';
  }

  isEnabled() {
    return Boolean(this.clientId && this.clientSecret);
  }

  /** O site precisa do client id (público) para montar o link de login. */
  publicConfig() {
    return { enabled: this.isEnabled(), clientId: this.isEnabled() ? this.clientId : null };
  }

  async profileFromCode(code: string, redirectUri: string): Promise<GoogleProfile> {
    if (!this.isEnabled()) throw new ServiceUnavailableException('Login com Google não configurado.');
    const url = new URL(redirectUri);
    if (url.pathname !== CALLBACK_PATH || !['http:', 'https:'].includes(url.protocol) || url.search) {
      throw new BadRequestException('Endereço de retorno inválido.');
    }

    let data: { id_token?: string; error?: string };
    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(10_000),
      });
      data = (await res.json()) as typeof data;
      if (!res.ok) this.logger.warn(`Google token: ${res.status} ${data.error ?? ''}`);
    } catch {
      throw new ServiceUnavailableException('O Google não respondeu. Tente de novo.');
    }
    if (!data.id_token) throw new UnauthorizedException('O Google não confirmou o login. Tente de novo.');

    // O id_token veio direto do Google por HTTPS, autenticado com o segredo do cliente:
    // pela especificação do OpenID Connect, basta conferir emissor, destinatário e validade.
    const claims = this.decode(data.id_token);
    if (!ISSUERS.includes(claims.iss) || claims.aud !== this.clientId || claims.exp * 1000 < Date.now()) {
      throw new UnauthorizedException('Login com Google inválido. Tente de novo.');
    }
    if (!claims.email || !claims.email_verified) {
      throw new UnauthorizedException('Sua conta Google precisa ter um e-mail verificado.');
    }
    return {
      googleId: claims.sub,
      email: claims.email.toLowerCase(),
      name: (claims.name ?? claims.given_name ?? claims.email.split('@')[0]).slice(0, 40),
      picture: claims.picture?.startsWith('https://') ? claims.picture : null,
    };
  }

  /** Nome de usuário livre a partir do e-mail: "Ana.Souza+x@…" → "anasouza", "anasouza2"… */
  async uniqueUsername(email: string): Promise<string> {
    let base = email
      .split('@')[0]
      .split('+')[0]
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 16);
    if (base.length < 3) base = `jogador${base}`.slice(0, 16);
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? base : `${base}${i + 1}`;
      const taken = await this.prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
      if (!taken) return candidate;
    }
    return `${base.slice(0, 12)}${Math.floor(1000 + Math.random() * 9000)}`;
  }

  private decode(idToken: string): IdTokenClaims {
    const payload = idToken.split('.')[1];
    if (!payload) throw new UnauthorizedException('Login com Google inválido.');
    try {
      return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as IdTokenClaims;
    } catch {
      throw new UnauthorizedException('Login com Google inválido.');
    }
  }
}
