import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { USER_PATTERNS } from '@app/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @MessagePattern(USER_PATTERNS.CREATE)
  async create(@Payload() dto: CreateUserDto) {
    try {
      const user = await this.userService.create(dto);
      return { success: true, data: user };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  @MessagePattern(USER_PATTERNS.FIND_ALL)
  async findAll(@Payload() dto: { skip?: number; limit?: number }) {
    try {
      const result = await this.userService.list(
        dto.skip ?? 0,
        dto.limit ?? 20,
      );
      return { success: true, data: result };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  @MessagePattern(USER_PATTERNS.FIND_ONE)
  async findOne(@Payload() id: string) {
    try {
      const user = await this.userService.findById(id);
      if (!user) {
        return { success: false, error: 'User not found' };
      }
      return { success: true, data: user };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  @MessagePattern(USER_PATTERNS.UPDATE)
  async update(
    @Payload() dto: { id: string; updates: Record<string, unknown> },
  ) {
    try {
      const user = await this.userService.update(dto.id, dto.updates);
      return { success: true, data: user };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  @MessagePattern(USER_PATTERNS.SOFT_DELETE)
  async softDelete(@Payload() id: string) {
    try {
      const user = await this.userService.softDelete(id);
      return { success: true, data: user };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
