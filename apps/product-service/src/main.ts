import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { ProductServiceModule } from './product-service.module';

async function bootstrap() {
  const host = process.env.PRODUCT_SERVICE_HOST || '0.0.0.0';
  const port = parseInt(process.env.PRODUCT_SERVICE_PORT || '3001', 10);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ProductServiceModule,
    {
      transport: Transport.TCP,
      options: { host, port },
      bufferLogs: true,
    },
  );

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen();
  console.log(`🚀 Product Service is listening on ${host}:${port}`);
}

bootstrap();
