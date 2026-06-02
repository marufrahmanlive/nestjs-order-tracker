import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import {
  CreateUserDto,
  UpdateUserDto,
  USER_PATTERNS,
  SERVICES,
  ServiceResponse,
  IUser,
  Roles,
} from '@app/common';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    @Inject(SERVICES.USER)
    private readonly userClient: ClientProxy,

    @InjectPinoLogger(UsersController.name)
    private readonly logger: PinoLogger,
  ) {}

  @ApiOperation({
    summary: 'Create a new user',
    description: 'Admin only. Creates a new user account.',
  })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiBearerAuth('access-token')
  @Roles('admin', 'user')
  @Post()
  async create(@Body() dto: CreateUserDto) {
    this.logger.info(
      { email: dto.email },
      'POST /users — forwarding to User Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IUser>>(
      this.userClient.send(USER_PATTERNS.CREATE, dto),
    );

    if (!response.success) {
      this.logger.warn(
        { error: response.error },
        'User creation failed via gateway',
      );
      throw new HttpException(
        response.error || 'Failed to create user',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.info(
      { userId: response.data?._id },
      'User created via gateway',
    );
    return response.data;
  }

  @ApiOperation({
    summary: 'List all users',
    description:
      'Admin only. Paginated user listing (excludes soft-deleted users).',
  })
  @ApiQuery({
    name: 'skip',
    required: false,
    description: 'Number of records to skip (default: 0)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max records to return (default: 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated user list with total count',
  })
  @ApiBearerAuth('access-token')
  @Roles('admin', 'user')
  @Get()
  async findAll(@Query('skip') skip?: string, @Query('limit') limit?: string) {
    this.logger.info('GET /users — forwarding to User Service via TCP');

    const response = await firstValueFrom<
      ServiceResponse<{
        items: IUser[];
        total: number;
        skip: number;
        limit: number;
      }>
    >(
      this.userClient.send(USER_PATTERNS.FIND_ALL, {
        skip: skip ? parseInt(skip, 10) : 0,
        limit: limit ? parseInt(limit, 10) : 20,
      }),
    );

    if (!response.success) {
      this.logger.warn(
        { error: response.error },
        'Failed to fetch users via gateway',
      );
      throw new HttpException(
        response.error || 'Failed to fetch users',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.info(
      { count: response.data?.total },
      'Users fetched via gateway',
    );
    return response.data;
  }

  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Admin only. Fetches a single user by MongoDB ObjectId.',
  })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiBearerAuth('access-token')
  @Roles('user', 'admin')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.info(
      { userId: id },
      'GET /users/:id — forwarding to User Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IUser>>(
      this.userClient.send(USER_PATTERNS.FIND_ONE, id),
    );

    if (!response.success) {
      this.logger.warn(
        { userId: id, error: response.error },
        'User not found via gateway',
      );
      throw new HttpException(
        response.error || 'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return response.data;
  }

  @ApiOperation({
    summary: 'Update user',
    description:
      'Admin only. Partially updates a user (name, roles, isActive).',
  })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiBearerAuth('access-token')
  @Roles('admin', 'user')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updates: UpdateUserDto) {
    this.logger.info(
      { userId: id },
      'PATCH /users/:id — forwarding to User Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IUser>>(
      this.userClient.send(USER_PATTERNS.UPDATE, { id, updates }),
    );

    if (!response.success) {
      this.logger.warn(
        { userId: id, error: response.error },
        'User update failed via gateway',
      );
      throw new HttpException(
        response.error || 'Failed to update user',
        HttpStatus.BAD_REQUEST,
      );
    }

    return response.data;
  }

  @ApiOperation({
    summary: 'Soft delete user',
    description:
      'Admin only. Marks user as deleted (does not permanently remove).',
  })
  @ApiResponse({ status: 200, description: 'User soft deleted' })
  @ApiResponse({ status: 400, description: 'User not found' })
  @ApiBearerAuth('access-token')
  @Roles('admin', 'user')
  @Delete(':id')
  async softDelete(@Param('id') id: string) {
    this.logger.info(
      { userId: id },
      'DELETE /users/:id — forwarding to User Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IUser>>(
      this.userClient.send(USER_PATTERNS.SOFT_DELETE, id),
    );

    if (!response.success) {
      this.logger.warn(
        { userId: id, error: response.error },
        'User soft delete failed via gateway',
      );
      throw new HttpException(
        response.error || 'Failed to delete user',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.info({ userId: id }, 'User soft deleted via gateway');
    return response.data;
  }
}
