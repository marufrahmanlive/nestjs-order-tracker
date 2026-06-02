import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants/auth.constants';

/**
 * Decorator to mark a route as public (skip JWT authentication).
 *
 * Usage:
 *   @Public()
 *   @Get('health')
 *   healthCheck() { return 'ok'; }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
