import {
  Controller,
  Get,
  Post,
  Body,
  Param,
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
} from '@nestjs/swagger';

import {
  CreateOrderDto,
  ORDER_PATTERNS,
  SERVICES,
  ServiceResponse,
  IOrder,
  Roles,
} from '@app/common';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(
    @Inject(SERVICES.ORDER)
    private readonly orderClient: ClientProxy,

    @InjectPinoLogger(OrdersController.name)
    private readonly logger: PinoLogger,
  ) {}

  @ApiOperation({
    summary: 'Create an order',
    description:
      'Requires user or admin role. Validates stock via Product Service, reduces inventory, saves order, and publishes a RabbitMQ event.',
  })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Insufficient stock or validation failed',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth('access-token')
  @Roles('user', 'admin')
  @Post()
  async create(@Body() dto: CreateOrderDto) {
    this.logger.info(
      { customerId: dto.customerId, itemCount: dto.items.length },
      'POST /orders — forwarding to Order Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IOrder>>(
      this.orderClient.send(ORDER_PATTERNS.CREATE, dto),
    );

    if (!response.success) {
      this.logger.warn(
        { error: response.error },
        'Order creation failed via gateway',
      );
      throw new HttpException(
        response.error || 'Failed to create order',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.info(
      { orderId: response.data?._id },
      'Order created successfully via gateway',
    );
    return response.data;
  }

  @ApiOperation({
    summary: 'List all orders',
    description: 'Admin only. Returns all orders.',
  })
  @ApiResponse({ status: 200, description: 'List of orders' })
  @ApiBearerAuth('access-token')
  @Roles('admin')
  @Get()
  async findAll() {
    this.logger.info('GET /orders — forwarding to Order Service via TCP');

    const response = await firstValueFrom<ServiceResponse<IOrder[]>>(
      this.orderClient.send(ORDER_PATTERNS.FIND_ALL, {}),
    );

    if (!response.success) {
      this.logger.warn(
        { error: response.error },
        'Failed to fetch orders via gateway',
      );
      throw new HttpException(
        response.error || 'Failed to fetch orders',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.info(
      { count: response.data?.length },
      'Orders fetched via gateway',
    );
    return response.data;
  }

  @ApiOperation({
    summary: 'Get order by ID',
    description: 'Admin only. Fetches a single order by MongoDB ObjectId.',
  })
  @ApiResponse({ status: 200, description: 'Order found' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiBearerAuth('access-token')
  @Roles('admin')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.info(
      { orderId: id },
      'GET /orders/:id — forwarding to Order Service via TCP',
    );

    const response = await firstValueFrom<ServiceResponse<IOrder>>(
      this.orderClient.send(ORDER_PATTERNS.FIND_ONE, id),
    );

    if (!response.success) {
      this.logger.warn(
        { orderId: id, error: response.error },
        'Order not found via gateway',
      );
      throw new HttpException(
        response.error || 'Order not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return response.data;
  }
}
