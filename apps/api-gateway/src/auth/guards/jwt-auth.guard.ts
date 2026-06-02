import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@app/common';

/**
 * Guard that triggers the 'jwt' Passport strategy.
 *
 * Registered as a GLOBAL guard in main.ts — protects ALL routes by default.
 * Routes marked with @Public() will skip JWT verification.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | import('rxjs').Observable<boolean> {
    // Check for @Public() decorator on either the handler or controller class.
    // If found, skip JWT verification entirely — useful for login/register/health routes.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Delegate to passport-jwt strategy to validate the Bearer token
    return super.canActivate(context);
  }
}
