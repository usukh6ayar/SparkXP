import { Type } from 'class-transformer';
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsUUID,
  IsString,
} from 'class-validator';

/** Query for GET /api/words/quiz — how many questions to generate. */
export class QuizQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(30)
  count?: number = 10;
}

/** One answer the student submitted: the word + the Mongolian option they chose. */
export class QuizAnswerDto {
  @IsUUID()
  wordId: string;

  /** The Mongolian meaning the student picked. Graded server-side. */
  @IsString()
  choice: string;
}

/** Body for POST /api/words/quiz/submit. */
export class QuizSubmitDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers: QuizAnswerDto[];
}
