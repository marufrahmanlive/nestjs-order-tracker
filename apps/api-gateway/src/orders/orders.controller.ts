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
  CreateOrderDto,
  ORDER_PATTERNS,
  SERVICES,
  ServiceResponse,
  IOrder,
} from '@app/common';

@Controller('orders')
export class OrdersController {
  constructor(
    @Inject(SERVICES.ORDER)
    private readonly orderClient: ClientProxy,

    @InjectPinoLogger(OrdersController.name)
    private readonly logger: PinoLogger,
  ) {}

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
      this.logger.warn({ error: response.error }, 'Order creation failed via gateway');
      throw new HttpException(response.error || 'Failed to create order', HttpStatus.BAD_REQUEST);
    }

    this.logger.info({ orderId: response.data?._id }, 'Order created successfully via gateway');
    return response.data;
  }

  @Get()
  async findAll() {
    this.logger.info('GET /orders — forwarding to Order Service via TCP');

    const response = await firstValueFrom<ServiceResponse<IOrder[]>>(
      this.orderClient.send(ORDER_PATTERNS.FIND_ALL, {}),
    );

    if (!response.success) {
      this.logger.warn({ error: response.error }, 'Failed to fetch orders via gateway');
      throw new HttpException(response.error || 'Failed to fetch orders', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    this.logger.info({ count: response.data?.length }, 'Orders fetched via gateway');
    return response.data;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.info({ orderId: id }, 'GET /orders/:id — forwarding to Order Service via TCP');

    const response = await firstValueFrom<ServiceResponse<IOrder>>(
      this.orderClient.send(ORDER_PATTERNS.FIND_ONE, id),
    );

    if (!response.success) {
      this.logger.warn({ orderId: id, error: response.error }, 'Order not found via gateway');
      throw new HttpException(response.error || 'Order not found', HttpStatus.NOT_FOUND);
    }

    return response.data;
  }
}
