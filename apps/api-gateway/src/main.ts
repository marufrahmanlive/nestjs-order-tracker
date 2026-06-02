import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiGatewayModule } from './api-gateway.module';
import { HttpExceptionFilter } from '@app/common';

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
  //
  // Both JwtAuthGuard and RolesGuard are registered via APP_GUARD in AuthModule
  // (NestJS official pattern: { provide: APP_GUARD, useClass: ... })
  // Order in providers array controls execution order:
  //   JwtAuthGuard runs FIRST → populates request.user
  //   RolesGuard runs SECOND → enforces role-based access (@Roles('admin'))

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // ─────────────────────────────────────────────────────────────────────────
  // Swagger / OpenAPI Documentation
  // ─────────────────────────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Order Tracker API')
    .setDescription(
      'Microservices-based order tracking system with JWT authentication.\n\n' +
        '**Authentication**: Register/Login to get a JWT access token. ' +
        'Click the **Authorize** button and enter `Bearer <your-token>`.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT access token',
      },
      'access-token',
    )
    .addTag('Auth', 'Authentication endpoints (register, login, refresh)')
    .addTag('Products', 'Product management (CRUD + stock)')
    .addTag('Orders', 'Order management (create, list, get by id)')
    .addTag('Users', 'User management (CRUD + soft delete)')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port);
  console.log(`🚀 API Gateway running on http://localhost:${port}/api/v1`);
  console.log(`📖 Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
