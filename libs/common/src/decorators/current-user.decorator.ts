import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Parameter decorator to extract the authenticated user from the request.
 *
 * Usage in controller:
 *   @Get('profile')
 *   async getProfile(@CurrentUser() user) {
 *     return user;
 *   }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
