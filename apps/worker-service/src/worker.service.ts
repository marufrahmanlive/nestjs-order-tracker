import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { OrderCreatedEvent } from '@app/common';

@Injectable()
export class WorkerService {
  constructor(
    @InjectPinoLogger(WorkerService.name)
    private readonly logger: PinoLogger,
  ) {}

  async processOrderCreated(event: OrderCreatedEvent): Promise<void> {
    this.logger.info(
      {
        orderId: event.orderId,
        customerId: event.customerId,
        totalAmount: event.totalAmount,
        itemCount: event.items.length,
      },
      '📨 Processing order.created event',
    );

    // ── Simulated Task 1: Send Notification ──────────────────────────────
    await this.simulateSendNotification(event);

    // ── Simulated Task 2: Analytics Tracking ────────────────────────────
    await this.simulateAnalyticsTracking(event);

    this.logger.info({ orderId: event.orderId }, '✅ order.created event processing complete');
  }

  private async simulateSendNotification(event: OrderCreatedEvent): Promise<void> {
    this.logger.info(
      { orderId: event.orderId, customerId: event.customerId },
      '📧 Simulating: Sending order confirmation email to customer',
    );

    // Simulate async email sending delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    this.logger.info(
      { orderId: event.orderId },
      '📧 Notification sent successfully (simulated)',
    );
  }

  private async simulateAnalyticsTracking(event: OrderCreatedEvent): Promise<void> {
    this.logger.info(
      {
        orderId: event.orderId,
        totalAmount: event.totalAmount,
        itemCount: event.items.length,
      },
      '📊 Simulating: Recording analytics event',
    );

    // Simulate analytics API call delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    this.logger.info(
      { orderId: event.orderId },
      '📊 Analytics event recorded successfully (simulated)',
    );
  }
}
