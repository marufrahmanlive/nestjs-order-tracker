import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import {
  CreateOrderDto,
  PRODUCT_PATTERNS,
  RABBITMQ_QUEUES,
  SERVICES,
  OrderStatus,
  OrderCreatedEvent,
  ServiceResponse,
  IProduct,
} from '@app/common';
import { Order, OrderDocument } from './schemas/order.schema';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,

    @Inject(SERVICES.PRODUCT)
    private readonly productClient: ClientProxy,

    @Inject('RABBITMQ_CLIENT')
    private readonly rabbitMQClient: ClientProxy,

    @InjectPinoLogger(OrderService.name)
    private readonly logger: PinoLogger,
  ) {}

  async create(dto: CreateOrderDto): Promise<Order> {
    this.logger.info({ customerId: dto.customerId, itemCount: dto.items.length }, 'Starting order creation flow');

    // ── Step 1: Validate all products exist and have enough stock ──────────
    this.logger.info('Step 1: Validating product stock via Product Service (TCP)');

    let totalAmount = 0;
    const enrichedItems: { productId: string; quantity: number; unitPrice: number }[] = [];

    for (const item of dto.items) {
      const response = await firstValueFrom<ServiceResponse<IProduct>>(
        this.productClient.send(PRODUCT_PATTERNS.FIND_ONE, item.productId),
      );

      if (!response.success || !response.data) {
        const msg = `Product ${item.productId} not found`;
        this.logger.warn({ productId: item.productId }, msg);
        throw new Error(msg);
      }

      const product = response.data;
      if (product.stock < item.quantity) {
        const msg = `Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`;
        this.logger.warn({ productId: item.productId, available: product.stock, requested: item.quantity }, msg);
        throw new Error(msg);
      }

      enrichedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.price,
      });
      totalAmount += product.price * item.quantity;
    }

    this.logger.info({ totalAmount }, 'Step 1 complete: All products validated');

    // ── Step 2: Reduce stock in Product Service ────────────────────────────
    this.logger.info('Step 2: Reducing stock in Product Service (TCP)');

    for (const item of enrichedItems) {
      const stockResponse = await firstValueFrom<ServiceResponse<void>>(
        this.productClient.send(PRODUCT_PATTERNS.REDUCE_STOCK, {
          productId: item.productId,
          quantity: item.quantity,
        }),
      );

      if (!stockResponse.success) {
        const msg = `Failed to reduce stock for product ${item.productId}: ${stockResponse.error}`;
        this.logger.error({ productId: item.productId }, msg);
        throw new Error(msg);
      }

      this.logger.debug({ productId: item.productId, quantity: item.quantity }, 'Stock reduced');
    }

    this.logger.info('Step 2 complete: All stock reduced');

    // ── Step 3: Save order to MongoDB ──────────────────────────────────────
    this.logger.info('Step 3: Saving order to MongoDB');

    const order = new this.orderModel({
      customerId: dto.customerId,
      items: enrichedItems,
      totalAmount,
      status: OrderStatus.CONFIRMED,
    });

    const savedOrder = await order.save();
    this.logger.info({ orderId: savedOrder._id }, 'Step 3 complete: Order saved to MongoDB');

    // ── Step 4: Publish RabbitMQ event ─────────────────────────────────────
    this.logger.info({ orderId: savedOrder._id }, 'Step 4: Publishing order.created event to RabbitMQ');

    const event: OrderCreatedEvent = {
      orderId: String(savedOrder._id),
      customerId: savedOrder.customerId,
      items: savedOrder.items,
      totalAmount: savedOrder.totalAmount,
      createdAt: new Date(),
    };

    this.rabbitMQClient.emit(RABBITMQ_QUEUES.ORDER_CREATED, event);

    this.logger.info({ orderId: savedOrder._id }, 'Step 4 complete: order.created event published');
    this.logger.info({ orderId: savedOrder._id, totalAmount }, '✅ Order creation flow complete');

    return savedOrder;
  }

  async findAll(): Promise<Order[]> {
    this.logger.info('Fetching all orders from MongoDB');
    const orders = await this.orderModel.find().lean().exec();
    this.logger.info({ count: orders.length }, 'Orders fetched');
    return orders;
  }

  async findOne(id: string): Promise<Order> {
    this.logger.info({ orderId: id }, 'Fetching order by id from MongoDB');
    const order = await this.orderModel.findById(id).lean().exec();
    if (!order) {
      this.logger.warn({ orderId: id }, 'Order not found');
      throw new Error(`Order ${id} not found`);
    }
    return order;
  }
}
