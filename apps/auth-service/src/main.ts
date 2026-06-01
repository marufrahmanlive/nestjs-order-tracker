import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AuthModule } from './auth.module';
import { RpcExceptionFilter } from '@app/common';

async function bootstrap() {
  const host = process.env.AUTH_SERVICE_HOST || '0.0.0.0';
  const port = parseInt(process.env.AUTH_SERVICE_PORT || '3003', 10);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AuthModule,
    {
      transport: Transport.TCP,
      options: { host, port },
      bufferLogs: true,
    },
  );

  app.useLogger(app.get(Logger));

  app.useGlobalFilters(new RpcExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen();
  console.log(`🚀 Auth Service is listening on ${host}:${port}`);
}

bootstrap();
