import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Reads the JWT if one is present, but never rejects the request.
 *
 * For routes that stay public yet behave differently for a signed-in user —
 * `GET /lessons/:id` is the case this was added for: anyone may read a lesson's
 * title and description, but whether the paid content comes back depends on who
 * is asking. Using the normal `JwtAuthGuard` there would 401 anonymous browsing;
 * using no guard at all would mean the server cannot tell who is asking, and the
 * paywall would exist only in the app.
 *
 * `request.user` is the User on success and `undefined` otherwise, so handlers
 * must treat it as optional.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Passport calls this with whatever the strategy produced. Swallowing the
   * error (rather than rethrowing, which is the default) is what makes the
   * guard optional: a missing, expired, or malformed token all just mean
   * "anonymous" instead of a 401.
   */
  handleRequest<TUser>(_err: unknown, user: TUser): TUser | undefined {
    return user || undefined;
  }
}
