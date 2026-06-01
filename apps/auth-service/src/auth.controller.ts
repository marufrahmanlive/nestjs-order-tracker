import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AUTH_PATTERNS,
  LoginDto,
  RegisterDto,
  ValidateUserDto,
} from '@app/common';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern(AUTH_PATTERNS.REGISTER)
  async register(@Payload() dto: RegisterDto) {
    try {
      const user = await this.authService.register(dto);
      return { success: true, data: user };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  async login(@Payload() dto: LoginDto) {
    try {
      const user = await this.authService.login(dto);
      return { success: true, data: user };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  @MessagePattern(AUTH_PATTERNS.VALIDATE_USER)
  async validateUser(@Payload() dto: ValidateUserDto) {
    try {
      const user = await this.authService.validateUser(dto.email, dto.password);
      return { success: true, data: user };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  @MessagePattern(AUTH_PATTERNS.FIND_BY_ID)
  async findById(@Payload() id: string) {
    try {
      const user = await this.authService.findById(id);
      return { success: true, data: user };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  @MessagePattern(AUTH_PATTERNS.FIND_BY_EMAIL)
  async findByEmail(@Payload() email: string) {
    try {
      const user = await this.authService.findByEmail(email);
      return { success: true, data: user };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
