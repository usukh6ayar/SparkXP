import { IsString, MinLength } from 'class-validator';

/** Body of `DELETE /users/me` — the account password, re-typed to confirm. */
export class DeleteAccountDto {
  @IsString()
  @MinLength(1, { message: 'Нууц үгээ оруулна уу' })
  password: string;
}
