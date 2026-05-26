import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { LoggerModule } from 'nestjs-pino';

import { SERVICES } from '@app/common';
import { ProductsController } from './products/products.controller';
import { OrdersController } from './orders/orders.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: false } }
            : undefined,
        // Structured request/response logging
        customLogLevel: (_req, res) => {
          if (res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            userAgent: req.headers['user-agent'],
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),

    // TCP client for Product Service
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

    // TCP client for Order Service
    ClientsModule.registerAsync([
      {
        name: SERVICES.ORDER,
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('ORDER_SERVICE_HOST', 'localhost'),
            port: config.get<number>('ORDER_SERVICE_PORT', 3002),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [ProductsController, OrdersController],
})
export class ApiGatewayModule {}
