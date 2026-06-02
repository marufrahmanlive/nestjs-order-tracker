import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  LoginResponseDto,
} from '@app/common';
import { Public } from '@app/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectPinoLogger(AuthController.name)
    private readonly logger: PinoLogger,
  ) {}

  @ApiOperation({
    summary: 'Register a new user',
    description: 'Creates a new user account. No authentication required.',
  })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({
    status: 400,
    description: 'Email already registered or validation failed',
  })
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
  @ApiOperation({
    summary: 'Login',
    description: 'Authenticate with email/password to receive JWT tokens.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
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
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Exchange a valid refresh token for a new access/refresh token pair (token rotation).',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    this.logger.info('POST /auth/refresh');
    return this.authService.refreshToken(dto.refreshToken);
  }
}
