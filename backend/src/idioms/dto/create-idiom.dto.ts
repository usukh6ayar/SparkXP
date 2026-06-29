import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

/** Body for POST /api/idioms. Admins author idioms from the admin panel. */
export class CreateIdiomDto {
  @IsString()
  @MaxLength(200)
  phrase: string;

  @IsString()
  @MaxLength(300)
  mongolian: string;

  /** Real (figurative) meaning, in Mongolian. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  meaning?: string;

  /** Explanation / usage note. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  definition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  exampleSentence?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  exampleTranslation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  audioUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
