import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that triggers the 'local' Passport strategy.
 * Used on the login route to validate email/password before issuing tokens.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
