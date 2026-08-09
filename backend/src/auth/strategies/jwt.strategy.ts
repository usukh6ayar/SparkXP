import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { resolveJwtSecret } from '../jwt-secret';

/** Shape of the data we sign into the JWT. */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: string;
  /**
   * Set on tokens that are NOT session tokens (currently only the short-lived
   * social sign-up ticket). Absent on every access token. See `validate()`.
   */
  purpose?: string;
}

/**
 * Validates the Bearer token on protected routes. Passport verifies the
 * signature/expiry, then `validate()` runs — we load the user so downstream
 * code gets a real, current User (not just token claims).
 *
 * Whatever `validate()` returns is attached to `request.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(config),
    });
  }

  async validate(payload: JwtPayload) {
    // Single-purpose tokens are signed with the same secret, so they would
    // otherwise be accepted here as a session. The social sign-up ticket
    // carries a provider `sub` rather than a user id, so it could not name a
    // real account — but refuse it by intent rather than relying on that.
    if (payload.purpose) {
      throw new UnauthorizedException('Токен хүчингүй байна');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      // Token was valid but the user no longer exists.
      throw new UnauthorizedException('Хэрэглэгч олдсонгүй');
    }
    return user;
  }
}
