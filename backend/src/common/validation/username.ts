import { applyDecorators } from '@nestjs/common';
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

/**
 * Username rules, in ONE place.
 *
 * A username is the login handle (`identifier` on POST /auth/login), so sign-up
 * (`RegisterDto`) and profile edit (`UpdateProfileDto`) must agree on what a
 * valid one looks like. Mirrors the mobile copy in `mobile/src/lib/username.ts`.
 */
export const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/** `@IsUsername()` — 3–30 characters of letters, numbers and `_`. */
export function IsUsername(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(USERNAME_MIN),
    MaxLength(USERNAME_MAX),
    Matches(USERNAME_RE, { message: 'Username зөвхөн үсэг, тоо, _ агуулна' }),
  );
}
