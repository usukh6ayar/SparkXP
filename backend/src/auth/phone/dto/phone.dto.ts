import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MN_PROVINCES } from '../../../common/enums';
import { IsUsername } from '../../../common/validation/username';
import { NoBlockedWords } from '../../../common/validation/blocked-words';

/** POST /auth/phone/start */
export class StartPhoneDto {
  @IsString()
  @MaxLength(20)
  phone: string;

  @IsIn(['register', 'login', 'reset'])
  purpose: 'register' | 'login' | 'reset';
}

/** POST /users/me/phone/start */
export class StartLinkPhoneDto {
  @IsString()
  @MaxLength(20)
  phone: string;
}

/** Any consumer that only needs the proof. */
export class VerificationIdDto {
  @IsUUID()
  verificationId: string;
}

/** POST /auth/phone/reset */
export class PhoneResetDto extends VerificationIdDto {
  @IsString()
  @MinLength(6, { message: 'Нууц үг дор хаяж 6 тэмдэгт байх ёстой' })
  @MaxLength(72, { message: 'Нууц үг хэт урт байна' })
  password: string;
}

/** POST /auth/register-phone — RegisterDto minus email-required, plus the proof. */
export class RegisterPhoneDto extends VerificationIdDto {
  @IsUsername()
  username: string;

  @IsString()
  @MinLength(6, { message: 'Нууц үг дор хаяж 6 тэмдэгт байх ёстой' })
  @MaxLength(72, { message: 'Нууц үг хэт урт байна' })
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @NoBlockedWords()
  fullName: string;

  /** Optional and NOT verified (spec decision 1). */
  @IsOptional()
  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  level?: string;

  @IsOptional()
  @IsIn([...MN_PROVINCES], { message: 'Аймаг/хот буруу байна' })
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  referralCode?: string;

  @IsOptional()
  @IsBoolean()
  tasteCompleted?: boolean;
}

/** GET /auth/check-availability */
export class CheckAvailabilityDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  /** Display name — checked against the blocked-word list before the SMS. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;
}
