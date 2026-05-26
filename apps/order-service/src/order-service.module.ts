import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { LoggerModule } from 'nestjs-pino';

import { SERVICES, RABBITMQ_QUEUES } from '@app/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { Order, OrderSchema } from './schemas/order.schema';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),

    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI', 'mongodb://localhost:27017/order_tracker'),
      }),
      inject: [ConfigService],
    }),

    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),

    // TCP client to communicate with Product Service
    ClientsModule.registerAsync([
      {
        name: SERVICES.PRODUCT,
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('PRODUCT_SERVICE_HOST', 'localhost'),
            port: config.get<number>('PRODUCT_SERVICE_PORT', 3001),
          },
        }),
        inject: [ConfigService],
      },
    ]),

    // RabbitMQ client to publish events
    ClientsModule.registerAsync([
      {
        name: 'RABBITMQ_CLIENT',
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672')],
            queue: RABBITMQ_QUEUES.ORDER_CREATED,
            queueOptions: { durable: true },
            persistent: true,
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderServiceModule {}
