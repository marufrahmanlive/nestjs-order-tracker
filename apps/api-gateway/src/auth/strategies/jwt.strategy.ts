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
  // Configure the strategy to extract JWT from the Authorization header and verify it using the secret.
  constructor(private readonly configService: ConfigService) {
    super({
      // Extract JWT from the Authorization: Bearer <token> header
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Do NOT accept expired tokens — passport will auto-reject them with 401
      ignoreExpiration: false,
      // Shared secret used for verification (must match what auth-service uses to sign)
      secretOrKey:
        configService.get<string>('JWT_ACCESS_SECRET') ?? 'fallback-secret',
    });
  }

  /**
   * Called AFTER passport-jwt has verified the token signature and expiry.
   * Returns what will be attached to request.user for downstream guards/controllers.
   *
   * No TCP/DB call needed here — the JWT payload is self-contained and trusted.
   * In a zero-trust architecture you'd re-validate against auth-service here.
   */
  async validate(payload: { sub: string; email: string; roles: string[] }) {
    return {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles,
    };
  }
}
