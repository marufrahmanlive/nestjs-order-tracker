import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { ApiGatewayModule } from './api-gateway.module';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '3000', 10);

  const app = await NestFactory.create(ApiGatewayModule, { bufferLogs: true });

  // Use Pino as the application logger
  app.useLogger(app.get(Logger));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api/v1');

  await app.listen(port);
  console.log(`🚀 API Gateway running on http://localhost:${port}/api/v1`);
}

bootstrap();
