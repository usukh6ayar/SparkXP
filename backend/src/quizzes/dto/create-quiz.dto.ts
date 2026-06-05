import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsArray,
  ValidateNested,
  IsIn,
  IsNumber,
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

export type QuestionDto = MultipleChoiceQuestionDto | FillBlankQuestionDto;

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
   * Array of question objects. Each must have a `type` field that selects
   * which DTO it is validated against (multiple_choice or fill_blank).
   * Using a discriminator (instead of `@Type(() => Object)`) is required so
   * that `whitelist: true` keeps each question's properties instead of
   * stripping them down to an empty object.
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object, {
    discriminator: {
      property: 'type',
      subTypes: [
        { value: MultipleChoiceQuestionDto, name: 'multiple_choice' },
        { value: FillBlankQuestionDto, name: 'fill_blank' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  questions: QuestionDto[];

  /** XP awarded when a student passes (>= 50% score). */
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
