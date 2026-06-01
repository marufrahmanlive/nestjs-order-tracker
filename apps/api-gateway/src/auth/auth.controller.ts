import {
  Controller,
  Post,
  Body,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import {
  AUTH_PATTERNS,
  LoginDto,
  RegisterDto,
  SERVICES,
  ServiceResponse,
  IUser,
} from '@app/common';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(SERVICES.AUTH)
    private readonly authClient: ClientProxy,

    @InjectPinoLogger(AuthController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    this.logger.info(
      { email: dto.email },
      'POST /auth/register — forwarding to Auth Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IUser>>(
      this.authClient.send(AUTH_PATTERNS.REGISTER, dto),
    );

    if (!response.success) {
      this.logger.warn(
        { error: response.error },
        'Registration failed via gateway',
      );
      throw new HttpException(
        response.error || 'Registration failed',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.info(
      { userId: response.data?._id },
      'User registered successfully via gateway',
    );
    return response.data;
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    this.logger.info(
      { email: dto.email },
      'POST /auth/login — forwarding to Auth Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IUser>>(
      this.authClient.send(AUTH_PATTERNS.LOGIN, dto),
    );

    if (!response.success) {
      this.logger.warn({ error: response.error }, 'Login failed via gateway');
      throw new HttpException(
        response.error || 'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.logger.info(
      { userId: response.data?._id },
      'User logged in via gateway',
    );
    return response.data;
  }
}
