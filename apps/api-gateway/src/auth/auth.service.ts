import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import {
  AUTH_PATTERNS,
  LoginDto,
  RegisterDto,
  LoginResponseDto,
  SERVICES,
  ServiceResponse,
  IUser,
} from '@app/common';

/**
 * Thin service in the API Gateway.
 *
 * All business logic (password hashing, JWT signing, refresh token rotation)
 * lives in auth-service. This service just forwards TCP requests.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(SERVICES.AUTH)
    private readonly authClient: ClientProxy,

    @InjectPinoLogger(AuthService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Validate user credentials via auth-service.
   * Used by LocalStrategy (passport-local).
   */
  async validateUser(email: string, password: string): Promise<IUser | null> {
    const response = await firstValueFrom<ServiceResponse<IUser>>(
      this.authClient.send(AUTH_PATTERNS.VALIDATE_USER, { email, password }),
    );

    if (!response.success) {
      this.logger.warn(
        { email, error: response.error },
        'User validation failed',
      );
      return null;
    }

    return response.data ?? null;
  }

  /**
   * Login — called AFTER LocalAuthGuard has validated credentials.
   * Sends credentials to auth-service which generates JWT tokens.
   */
  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const response = await firstValueFrom<ServiceResponse<LoginResponseDto>>(
      this.authClient.send(AUTH_PATTERNS.LOGIN, dto),
    );

    if (!response.success) {
      this.logger.warn(
        { email: dto.email, error: response.error },
        'Login failed',
      );
      throw new HttpException(
        response.error || 'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.logger.info({ userId: response.data?.user?._id }, 'Login successful');
    return response.data!;
  }

  /**
   * Register a new user via auth-service.
   */
  async register(dto: RegisterDto): Promise<IUser> {
    const response = await firstValueFrom<ServiceResponse<IUser>>(
      this.authClient.send(AUTH_PATTERNS.REGISTER, dto),
    );

    if (!response.success) {
      this.logger.warn(
        { email: dto.email, error: response.error },
        'Registration failed',
      );
      throw new HttpException(
        response.error || 'Registration failed',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.info({ userId: response.data?._id }, 'Registration successful');
    return response.data!;
  }

  /**
   * Refresh access token using a valid refresh token.
   * Auth-service validates the refresh token, rotates it, and returns new pair.
   */
  async refreshToken(token: string): Promise<LoginResponseDto> {
    const response = await firstValueFrom<ServiceResponse<LoginResponseDto>>(
      this.authClient.send(AUTH_PATTERNS.REFRESH_TOKEN, {
        refreshToken: token,
      }),
    );

    if (!response.success) {
      this.logger.warn({ error: response.error }, 'Token refresh failed');
      throw new HttpException(
        response.error || 'Token refresh failed',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.logger.info(
      { userId: response.data?.user?._id },
      'Token refreshed successfully',
    );
    return response.data!;
  }
}
