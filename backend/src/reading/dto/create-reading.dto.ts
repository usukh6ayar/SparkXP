import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsInt,
  IsIn,
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

/** One comprehension question (asked after finishing the passage). */
export class ReadingQuestionDto {
  @IsIn(['multiple_choice', 'fill_blank'])
  type: 'multiple_choice' | 'fill_blank';

  @IsString()
  @MaxLength(500)
  question: string;

  /** multiple_choice only. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  /** multiple_choice only: index of the correct option. */
  @IsOptional()
  @IsInt()
  @Min(0)
  correctIndex?: number;

  /** fill_blank only: expected answer. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  answer?: string;
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

  /** Topic/category (сэдэв) — free text, see READING_CATEGORY_SUGGESTIONS. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string | null;

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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReadingQuestionDto)
  comprehensionQuestions?: ReadingQuestionDto[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
