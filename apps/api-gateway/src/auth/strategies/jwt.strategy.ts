import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

/**
 * passport-jwt strategy — validates Bearer token using shared secret.
 *
 * No TCP call needed — JWT is self-validating with the shared secret.
 * Only auth-service needs to sign; the gateway only verifies locally.
 *
 * Follows NestJS passport docs:
 * https://docs.nestjs.com/recipes/passport#implementing-passport-jwt
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_ACCESS_SECRET') ?? 'fallback-secret',
    });
  }

  /**
   * Passport-jwt has already verified the signature and expiry.
   * Just shape the payload into request.user.
   */
  async validate(payload: { sub: string; email: string; roles: string[] }) {
    return {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles,
    };
  }
}
