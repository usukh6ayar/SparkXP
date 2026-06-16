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
  /** Unique handle chosen at sign-up — used to log in. */
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username зөвхөн үсэг, тоо, _ агуулна' })
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

  @IsOptional()
  @IsIn([...MN_PROVINCES], { message: 'Аймаг/хот буруу байна' })
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;
}
