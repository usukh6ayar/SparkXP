import {
  IsEmail,
  IsString,
  IsOptional,
  IsIn,
  IsBoolean,
  MinLength,
  MaxLength,
} from 'class-validator';
import { MN_PROVINCES, UserRole } from '../../common/enums';
import { IsUsername } from '../../common/validation/username';

/** Body for POST /api/auth/register. Validated by the global ValidationPipe. */
export class RegisterDto {
  /** Unique handle chosen at sign-up — used to log in. */
  @IsUsername()
  username: string;

  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Нууц үг дор хаяж 6 тэмдэгт байх ёстой' })
  @MaxLength(72, { message: 'Нууц үг хэт урт байна' })
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  /**
   * Role chosen at sign-up. Public register is locked to `student` only —
   * teacher/admin/moderator roles are assigned by an admin (`PATCH /users/:id`).
   */
  @IsOptional()
  @IsIn([UserRole.STUDENT], {
    message: 'Бүртгэлийн үед зөвхөн student сонгох боломжтой',
  })
  role?: UserRole.STUDENT;

  /** Placement / CEFR level (a1..c2). */
  @IsOptional()
  @IsString()
  @MaxLength(5)
  level?: string;

  /** Optional English name. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  englishName?: string;

  @IsOptional()
  @IsIn([...MN_PROVINCES], { message: 'Аймаг/хот буруу байна' })
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  /** Referral code (or username) of the friend who invited this user. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  referralCode?: string;

  /** True if the user finished the pre-signup taste-task (C4) → a one-time XP
   *  bonus is granted when the email is verified. Amount is server-fixed. */
  @IsOptional()
  @IsBoolean()
  tasteCompleted?: boolean;
}
