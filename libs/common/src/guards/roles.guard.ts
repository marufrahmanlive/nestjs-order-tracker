import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../constants/auth.constants';

/**
 * Guard that checks if the authenticated user has the required roles.
 *
 * Must run AFTER JwtAuthGuard (which populates request.user).
 * Registered as a global guard in main.ts.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Retrieve roles metadata from the handler (method) or controller (class).
    // Method-level @Roles() overrides class-level @Roles().
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator = no role restriction → allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // request.user is populated by JwtAuthGuard (which runs before this guard)
    // If there's no user, JWT is missing/invalid → deny
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      return false;
    }

    // Check if the user has at least ONE of the required roles (OR logic)
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
