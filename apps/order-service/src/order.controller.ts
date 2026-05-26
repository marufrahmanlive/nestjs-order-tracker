import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { CreateOrderDto, ORDER_PATTERNS } from '@app/common';
import { OrderService } from './order.service';

@Controller()
export class OrderController {
  constructor(
    private readonly orderService: OrderService,

    @InjectPinoLogger(OrderController.name)
    private readonly logger: PinoLogger,
  ) {}

  @MessagePattern(ORDER_PATTERNS.CREATE)
  async create(@Payload() dto: CreateOrderDto) {
    this.logger.info({ pattern: ORDER_PATTERNS.CREATE, customerId: dto.customerId }, 'TCP message received: create order');
    try {
      const order = await this.orderService.create(dto);
      return { success: true, data: order };
    } catch (error) {
      this.logger.error({ error: error.message }, 'Order creation failed');
      return { success: false, error: error.message };
    }
  }

  @MessagePattern(ORDER_PATTERNS.FIND_ALL)
  async findAll() {
    this.logger.info({ pattern: ORDER_PATTERNS.FIND_ALL }, 'TCP message received: find all orders');
    try {
      const orders = await this.orderService.findAll();
      return { success: true, data: orders };
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to find all orders');
      return { success: false, error: error.message };
    }
  }

  @MessagePattern(ORDER_PATTERNS.FIND_ONE)
  async findOne(@Payload() id: string) {
    this.logger.info({ pattern: ORDER_PATTERNS.FIND_ONE, orderId: id }, 'TCP message received: find order');
    try {
      const order = await this.orderService.findOne(id);
      return { success: true, data: order };
    } catch (error) {
      this.logger.error({ error: error.message, orderId: id }, 'Failed to find order');
      return { success: false, error: error.message };
    }
  }
}
