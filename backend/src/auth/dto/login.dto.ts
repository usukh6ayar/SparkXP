import { IsEmail, IsString } from 'class-validator';

/** Body for POST /api/auth/login. */
export class LoginDto {
  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  email: string;

  @IsString()
  password: string;
}
