import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { UserModule } from './user.module';
import { RpcExceptionFilter } from '@app/common';

async function bootstrap() {
  const host = process.env.USER_SERVICE_HOST || '0.0.0.0';
  const port = parseInt(process.env.USER_SERVICE_PORT || '3004', 10);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    UserModule,
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
  console.log(`🚀 User Service is listening on ${host}:${port}`);
}

bootstrap();
