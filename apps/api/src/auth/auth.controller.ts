import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@savepoint/shared';
import { ZodPipe } from '../core/zod.pipe';
import { Auth, CurrentUser, type AuthUser } from './auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body(new ZodPipe(registerSchema)) body: RegisterInput) {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodPipe(loginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  @Get('me')
  @Auth()
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
