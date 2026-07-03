import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/** Body for POST /dictionary/translate — a full English sentence to translate. */
export class TranslateSentenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  text: string;
}
