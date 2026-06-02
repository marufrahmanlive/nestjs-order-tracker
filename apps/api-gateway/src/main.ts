import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { ApiGatewayModule } from './api-gateway.module';
import { HttpExceptionFilter, RolesGuard } from '@app/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '3000', 10);

  const app = await NestFactory.create(ApiGatewayModule, { bufferLogs: true });

  // Use Pino as the application logger
  app.useLogger(app.get(Logger));

  // Global exception filter - handles all exceptions with custom responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Global Guards — applied to ALL routes automatically
  // ───────────────────────────────────────────────────────────────────────────

  const reflector = app.get(Reflector);

  // 1. JwtAuthGuard: Verifies JWT on every request (unless @Public())
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  // 2. RolesGuard: Enforces role-based access (@Roles('admin'))
  //    Runs AFTER JwtAuthGuard so request.user is populated
  app.useGlobalGuards(new RolesGuard(reflector));

  // Global prefix
  app.setGlobalPrefix('api/v1');

  await app.listen(port);
  console.log(`🚀 API Gateway running on http://localhost:${port}/api/v1`);
}

bootstrap();
