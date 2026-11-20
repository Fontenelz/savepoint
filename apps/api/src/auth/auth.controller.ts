import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  googleAuthSchema,
  loginSchema,
  registerSchema,
  type GoogleAuthInput,
  type LoginInput,
  type RegisterInput,
} from '@savepoint/shared';
import { ZodPipe } from '../core/zod.pipe';
import { Auth, CurrentUser, type AuthUser } from './auth.guard';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleAuthService,
  ) {}

  @Post('register')
  register(@Body(new ZodPipe(registerSchema)) body: RegisterInput) {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodPipe(loginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  /** Se o login com Google está configurado e o client id (público) para montar o link. */
  @Get('google/config')
  googleConfig() {
    return this.google.publicConfig();
  }

  @Post('google')
  @HttpCode(200)
  loginWithGoogle(@Body(new ZodPipe(googleAuthSchema)) body: GoogleAuthInput) {
    return this.auth.loginWithGoogle(body.code, body.redirectUri);
  }

  @Get('me')
  @Auth()
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
