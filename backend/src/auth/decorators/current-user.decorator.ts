import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../entities/user.entity';

/**
 * Pulls the authenticated user off the request in a clean way:
 *
 *   @Get('me')
 *   me(@CurrentUser() user: User) { ... }
 *
 * Only valid on routes guarded by JwtAuthGuard (otherwise request.user is
 * undefined).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
