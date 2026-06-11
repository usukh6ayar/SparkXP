import {
  IsEmail,
  IsString,
  IsOptional,
  IsIn,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { MN_PROVINCES, UserRole } from '../../common/enums';

/** Body for POST /api/auth/register. Validated by the global ValidationPipe. */
export class RegisterDto {
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

  /** Display username chosen at registration (e.g. "Bold123"). */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username зөвхөн үсэг, тоо, _ агуулна' })
  username?: string;

  /** Phone number (Mongolian 8-digit or international format). */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  /**
   * Role chosen at sign-up. Only student and teacher are allowed via the
   * public register endpoint — admin/moderator roles are set by super_admin only.
   */
  @IsOptional()
  @IsIn([UserRole.STUDENT, UserRole.TEACHER], {
    message: 'Бүртгэлийн үед зөвхөн student эсвэл teacher сонгох боломжтой',
  })
  role?: UserRole.STUDENT | UserRole.TEACHER;

  @IsOptional()
  @IsIn([...MN_PROVINCES], { message: 'Аймаг/хот буруу байна' })
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;
}
