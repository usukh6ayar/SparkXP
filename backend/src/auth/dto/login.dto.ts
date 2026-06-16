import { IsString } from 'class-validator';

/** Body for POST /api/auth/login. `identifier` = username or email. */
export class LoginDto {
  /** Username (mobile) or email (admin / legacy) — either works. */
  @IsString()
  identifier: string;

  @IsString()
  password: string;
}
