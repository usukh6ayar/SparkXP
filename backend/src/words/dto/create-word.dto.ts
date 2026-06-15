import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ContentLevel } from '../../common/enums';

/** Body for POST /api/words. Admins author vocabulary from the admin panel. */
export class CreateWordDto {
  @IsString()
  @MaxLength(200)
  english: string;

  @IsString()
  @MaxLength(200)
  mongolian: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  partOfSpeech?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  exampleSentence?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  exampleTranslation?: string;

  // URLs are stored as plain strings (CDN links). Kept simple — not validated
  // as strict URLs so relative/CDN paths are allowed.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  audioUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsEnum(ContentLevel)
  level?: ContentLevel;

  /** Optional owning lesson. */
  @IsOptional()
  @IsUUID()
  lessonId?: string;
}
