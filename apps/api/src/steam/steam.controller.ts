import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { steamImportSchema, steamLinkSchema, type SteamImportInput, type SteamLinkInput } from '@savepoint/shared';
import { Auth, CurrentUser, type AuthUser } from '../auth/auth.guard';
import { ZodPipe } from '../core/zod.pipe';
import { SteamService } from './steam.service';

@Controller('steam')
export class SteamController {
  constructor(private readonly steam: SteamService) {}

  /** Se a integração está configurada (há STEAM_API_KEY). */
  @Get('status')
  status() {
    return this.steam.enabled();
  }

  @Get('account')
  @Auth()
  account(@CurrentUser() user: AuthUser) {
    return this.steam.account(user.id);
  }

  @Post('link')
  @Auth()
  link(@Body(new ZodPipe(steamLinkSchema)) body: SteamLinkInput, @CurrentUser() user: AuthUser) {
    return this.steam.link(user.id, body.params);
  }

  /** Login com a Steam (OpenID) para contas que já conectaram a Steam. Público. */
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodPipe(steamLinkSchema)) body: SteamLinkInput) {
    return this.steam.login(body.params);
  }

  @Delete('link')
  @Auth()
  @HttpCode(204)
  unlink(@CurrentUser() user: AuthUser) {
    return this.steam.unlink(user.id);
  }

  @Get('library')
  @Auth()
  library(@CurrentUser() user: AuthUser) {
    return this.steam.library(user.id);
  }

  @Post('import')
  @Auth()
  import(@Body(new ZodPipe(steamImportSchema)) body: SteamImportInput, @CurrentUser() user: AuthUser) {
    return this.steam.import(user.id, body);
  }
}
