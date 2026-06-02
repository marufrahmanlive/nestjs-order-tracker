import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { SERVICES, RolesGuard } from '@app/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      useFactory: (config: ConfigService) =>
        ({
          secret: config.get<string>('JWT_ACCESS_SECRET'),
          signOptions: {
            expiresIn: config.get<string>('JWT_ACCESS_EXPIRY', '15m'),
            issuer: 'order-tracker-auth',
            audience: 'order-tracker-client',
          },
        }) as any,
      inject: [ConfigService],
    }),

    // TCP client for Auth Service
    ClientsModule.registerAsync([
      {
        name: SERVICES.AUTH,
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('AUTH_SERVICE_HOST', 'localhost'),
            port: config.get<number>('AUTH_SERVICE_PORT', 3003),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    // APP_GUARD is a special NestJS injection token.
    // Providing guards this way (rather than app.useGlobalGuards() in main.ts)
    // allows the guards to participate in DI — they can inject Reflector, AuthService, etc.
    //
    // ORDER MATTERS: JwtAuthGuard runs first (populates request.user),
    // then RolesGuard runs second (checks request.user.roles against @Roles() metadata).
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [AuthService, PassportModule],
})
export class AuthModule {}
