import {
  IsEmail,
  IsString,
  IsOptional,
  IsIn,
  MinLength,
  MaxLength,
} from 'class-validator';
import { MN_PROVINCES } from '../../common/enums';

/** Body for POST /api/auth/register. Validated by the global ValidationPipe. */
export class RegisterDto {
  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Нууц үг дор хаяж 6 тэмдэгт байх ёстой' })
  @MaxLength(72, { message: 'Нууц үг хэт урт байна' }) // bcrypt 72-byte limit
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  // Optional location, set at sign-up (feeds local leaderboards). Can also be
  // edited later via PATCH /api/users/me, or inherited from a school/org.
  @IsOptional()
  @IsIn([...MN_PROVINCES], { message: 'Аймаг/хот буруу байна' })
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;
}
