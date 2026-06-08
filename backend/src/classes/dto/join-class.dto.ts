import { IsString, IsNotEmpty, Length } from 'class-validator';

export class JoinClassDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 10)
  joinCode: string;
}
