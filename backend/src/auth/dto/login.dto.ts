import { IsString, IsOptional } from 'class-validator';

/**
 * Body for POST /api/auth/login. Accepts `identifier` (username or email).
 * `email` is kept as a legacy alias so the admin web (which still sends
 * `{ email }`) keeps working — service resolves `identifier ?? email`.
 */
export class LoginDto {
  @IsOptional()
  @IsString()
  identifier?: string;

  /** Legacy alias for `identifier` (admin web). */
  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  password: string;
}
