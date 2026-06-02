import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { LoginDto, RegisterDto, RefreshTokenDto } from '@app/common';
import { Public } from '@app/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectPinoLogger(AuthController.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * POST /api/v1/auth/register
   * Public — no authentication required.
   */
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    this.logger.info({ email: dto.email }, 'POST /auth/register');
    return this.authService.register(dto);
  }

  /**
   * POST /api/v1/auth/login
   *
   * @Public() - skip global JWT guard (no token required for login).
   * LocalAuthGuard triggers passport-local strategy for email/password.
   * On success, req.user is populated, then authService.login() generates tokens.
   */
  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: any, @Body() dto: LoginDto) {
    this.logger.info(
      { userId: req.user?._id },
      'POST /auth/login — user authenticated by LocalStrategy, issuing tokens',
    );
    return this.authService.login(dto);
  }

  /**
   * POST /api/v1/auth/refresh
   *
   * Public — uses refresh token from body instead of access token.
   * Auth-service validates the refresh token and returns a new token pair.
   */
  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    this.logger.info('POST /auth/refresh');
    return this.authService.refreshToken(dto.refreshToken);
  }
}
