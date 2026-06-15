import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsArray,
  ValidateNested,
  IsIn,
  Min,
  ArrayNotEmpty,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContentLevel } from '../../common/enums';

/** Multiple-choice question — one correct option from a list. */
export class MultipleChoiceQuestionDto {
  @IsIn(['multiple_choice'])
  type: 'multiple_choice';

  @IsString()
  question: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  options: string[];

  /** Zero-based index into `options` that is correct. */
  @IsInt()
  @Min(0)
  correct: number;

  @IsInt()
  @Min(1)
  points: number;
}

/** Fill-in-the-blank question — user types the expected answer. */
export class FillBlankQuestionDto {
  @IsIn(['fill_blank'])
  type: 'fill_blank';

  @IsString()
  question: string;

  /** Expected answer (comparison is case-insensitive, trimmed). */
  @IsString()
  answer: string;

  @IsInt()
  @Min(1)
  points: number;
}

/** A single English ↔ Mongolian word pair used in word-match questions. */
export class WordMatchPairDto {
  @IsString()
  left: string;

  @IsString()
  right: string;
}

/** Word-matching question — student matches left-column words to right-column. */
export class WordMatchQuestionDto {
  @IsIn(['word_match'])
  type: 'word_match';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WordMatchPairDto)
  @ArrayNotEmpty()
  pairs: WordMatchPairDto[];

  @IsInt()
  @Min(1)
  points: number;
}

export type QuestionDto =
  | MultipleChoiceQuestionDto
  | FillBlankQuestionDto
  | WordMatchQuestionDto;

export class CreateQuizDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ContentLevel)
  level?: ContentLevel;

  /**
   * Quiz category shown on the mobile home screen.
   * Values: 'multiple_choice' | 'fill_blank' | 'word_match'
   */
  @IsOptional()
  @IsString()
  quizType?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object, {
    discriminator: {
      property: 'type',
      subTypes: [
        { value: MultipleChoiceQuestionDto, name: 'multiple_choice' },
        { value: FillBlankQuestionDto, name: 'fill_blank' },
        { value: WordMatchQuestionDto, name: 'word_match' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  questions: QuestionDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  xpReward?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsUUID()
  lessonId?: string;
}
