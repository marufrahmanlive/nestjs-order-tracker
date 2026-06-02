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
    // Extract RabbitMQ channel and message for manual acknowledgment
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    this.logger.info(
      { orderId: event.orderId, queue: RABBITMQ_QUEUES.ORDER_CREATED },
      '🐇 RabbitMQ event received: order.created',
    );

    try {
      await this.workerService.processOrderCreated(event);

      // Manual ACK — tells RabbitMQ the message was processed successfully
      // Required because noAck: false in main.ts (manual acknowledgment mode)
      channel.ack(originalMsg);
      this.logger.info({ orderId: event.orderId }, '✅ Message acknowledged');
    } catch (error) {
      this.logger.error(
        { orderId: event.orderId, error: error.message },
        '❌ Error processing order.created event — rejecting message (requeue: false)',
      );

      // nack(originalMsg, false, false):
      //   - 2nd param false: do NOT re-queue (re-queueing would cause infinite loops on persistent errors)
      //   - 3rd param false: only reject this single message
      // In production: the rejected message should be routed to a Dead Letter Queue (DLQ) for manual review
      channel.nack(originalMsg, false, false);
    }
  }
}
