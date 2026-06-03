import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

/** Shape of the data we sign into the JWT. */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: string;
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
      secretOrKey: config.get<string>('JWT_SECRET', 'change-me'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      // Token was valid but the user no longer exists.
      throw new UnauthorizedException('Хэрэглэгч олдсонгүй');
    }
    return user;
  }
}
