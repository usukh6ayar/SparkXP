import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

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
}
