import { IsEmail, IsString, Length, MinLength, MaxLength } from 'class-validator';

/** POST /api/auth/verify-otp — confirm the email with the code. */
export class VerifyOtpDto {
  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  email: string;

  @IsString()
  @Length(6, 6, { message: 'Код 6 оронтой байна' })
  code: string;
}

/** POST /api/auth/resend-otp and /api/auth/forgot-password. */
export class EmailOnlyDto {
  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  email: string;
}

/** POST /api/auth/reset-password — set a new password using the emailed code. */
export class ResetPasswordDto {
  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  email: string;

  @IsString()
  @Length(6, 6, { message: 'Код 6 оронтой байна' })
  code: string;

  @IsString()
  @MinLength(6, { message: 'Нууц үг дор хаяж 6 тэмдэгт байх ёстой' })
  @MaxLength(72)
  password: string;
}
