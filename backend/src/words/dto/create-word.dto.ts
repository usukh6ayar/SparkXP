import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { ContentLevel, WordStatus } from '../../common/enums';

/** Body for POST /api/words. Admins author vocabulary from the admin panel. */
export class CreateWordDto {
  @IsString()
  @MaxLength(200)
  english: string;

  @IsString()
  @MaxLength(200)
  mongolian: string;

  /** English dictionary definition (separate from the Mongolian meaning). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  englishDefinition?: string;

  /** IPA pronunciation, e.g. /əˈbændən/. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  phonetic?: string;

  /** Memory aid / mnemonic shown in the flashcard "Spark сануулга" section. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sparkTip?: string;

  /** Topical category (free text — see VOCAB_CATEGORY_SUGGESTIONS). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  /** Review lifecycle. Defaults to `published` on the entity if omitted. */
  @IsOptional()
  @IsEnum(WordStatus)
  status?: WordStatus;

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

  /**
   * Admin-only request flag. If true, the WordsService asks the AI Gateway to
   * create and attach a vocabulary image after saving the word.
   */
  @IsOptional()
  @IsBoolean()
  generateImage?: boolean;
}
