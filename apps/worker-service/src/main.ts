import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { WorkerServiceModule } from './worker-service.module';
import { RABBITMQ_QUEUES } from '@app/common';

async function bootstrap() {
  const rabbitMQUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    WorkerServiceModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [rabbitMQUrl],
        queue: RABBITMQ_QUEUES.ORDER_CREATED,
        queueOptions: {
          durable: true,
        },
        prefetchCount: 10, // process 10 messages at a time
        noAck: false,      // manual acknowledgment
      },
      bufferLogs: true,
    },
  );

  app.useLogger(app.get(Logger));
  await app.listen();
  console.log('🚀 Worker Service is listening for RabbitMQ events');
}

bootstrap();
