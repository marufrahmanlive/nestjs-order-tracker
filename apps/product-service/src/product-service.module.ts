import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { LoggerModule } from 'nestjs-pino';
import { createKeyv } from '@keyv/redis';
import { CacheableMemory } from 'cacheable';
import { Keyv } from 'keyv';

import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { Product, ProductSchema } from './schemas/product.schema';

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
        serializers: {
          req: (req) => ({ method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      },
    }),

    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>(
          'MONGODB_URI',
          'mongodb://localhost:27017/order_tracker',
        ),
      }),
      inject: [ConfigService],
    }),

    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),

    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (config: ConfigService) => {
        const redisHost = config.get<string>('REDIS_HOST', 'localhost');
        const redisPort = config.get<number>('REDIS_PORT', 6379);

        return {
          store: createKeyv(`redis://${redisHost}:${redisPort}`) as any,
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductServiceModule {}
