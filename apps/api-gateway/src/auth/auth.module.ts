import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { SERVICES } from '@app/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
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
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService, PassportModule],
})
export class AuthModule {}
