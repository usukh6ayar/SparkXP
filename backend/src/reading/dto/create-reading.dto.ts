import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsInt,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContentLevel } from '../../common/enums';

/** One sentence in the create/update payload (admin-edited list). */
export class ReadingSentenceDto {
  @IsInt()
  @Min(0)
  index: number;

  @IsString()
  @MaxLength(2000)
  text: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  audioUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  startMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  endMs?: number;
}

/** One key-vocab item. Phase 1 sends just `word`; Phase 2 adds guess choices. */
export class ReadingKeyVocabDto {
  @IsString()
  @MaxLength(100)
  word: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  correctMeaning?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  choices?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  correctIndex?: number;

  @IsOptional()
  @IsBoolean()
  reviewed?: boolean;
}

/**
 * Body for POST /api/reading. The service computes `wordCount` and
 * `estimatedReadingTime` from the sentences, so they are not accepted here.
 */
export class CreateReadingDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsEnum(ContentLevel)
  cefr?: ContentLevel;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReadingKeyVocabDto)
  keyVocab?: ReadingKeyVocabDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReadingSentenceDto)
  sentences?: ReadingSentenceDto[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
