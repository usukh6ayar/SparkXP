import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protects a route: requires a valid JWT. Put `@UseGuards(JwtAuthGuard)` on a
 * controller or handler. On success, `request.user` holds the User from
 * JwtStrategy.validate().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
