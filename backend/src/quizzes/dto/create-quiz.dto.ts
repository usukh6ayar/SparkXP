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

  @IsOptional()
  @IsString()
  imageUrl?: string;
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

/** Open written/spoken response (IELTS Writing/Speaking) — self-study, points 0. */
export class OpenResponseQuestionDto {
  @IsIn(['open_response'])
  type: 'open_response';

  @IsString()
  prompt: string;

  @IsString()
  modelAnswer: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  bandNote?: string;

  // No `points`: open_response is self-study; the service always stores points 0.
}

export type QuestionDto =
  | MultipleChoiceQuestionDto
  | FillBlankQuestionDto
  | WordMatchQuestionDto
  | OpenResponseQuestionDto;

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

  /** Topic category for grouping a lesson's quizzes (e.g. "Дүрэм", "Үг").
   *  For a standalone exercise this is the skill (listening/reading/...). */
  @IsOptional()
  @IsString()
  category?: string;

  /** Sub-category (сэдэв) within a skill, e.g. "Өдөр тутмын яриа". Free text. */
  @IsOptional()
  @IsString()
  topic?: string;

  /** IELTS Reading passage text. */
  @IsOptional()
  @IsString()
  passageText?: string;

  /** IELTS Listening section audio URL. */
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object, {
    discriminator: {
      property: 'type',
      subTypes: [
        { value: MultipleChoiceQuestionDto, name: 'multiple_choice' },
        { value: FillBlankQuestionDto, name: 'fill_blank' },
        { value: WordMatchQuestionDto, name: 'word_match' },
        { value: OpenResponseQuestionDto, name: 'open_response' },
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
