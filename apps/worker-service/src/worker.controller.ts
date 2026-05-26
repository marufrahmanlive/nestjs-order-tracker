import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { RABBITMQ_QUEUES } from '@app/common';
import type { OrderCreatedEvent } from '@app/common';
import { WorkerService } from './worker.service';

@Controller()
export class WorkerController {
  constructor(
    private readonly workerService: WorkerService,

    @InjectPinoLogger(WorkerController.name)
    private readonly logger: PinoLogger,
  ) {}

  @EventPattern(RABBITMQ_QUEUES.ORDER_CREATED)
  async handleOrderCreated(
    @Payload() event: OrderCreatedEvent,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    this.logger.info(
      { orderId: event.orderId, queue: RABBITMQ_QUEUES.ORDER_CREATED },
      '🐇 RabbitMQ event received: order.created',
    );

    try {
      await this.workerService.processOrderCreated(event);

      // Acknowledge message after successful processing
      channel.ack(originalMsg);
      this.logger.info({ orderId: event.orderId }, '✅ Message acknowledged');
    } catch (error) {
      this.logger.error(
        { orderId: event.orderId, error: error.message },
        '❌ Error processing order.created event — rejecting message (requeue: false)',
      );

      // Reject without requeue to avoid infinite loops
      // In production: send to a Dead Letter Queue (DLQ)
      channel.nack(originalMsg, false, false);
    }
  }
}
