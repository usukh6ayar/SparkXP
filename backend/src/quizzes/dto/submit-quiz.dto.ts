import { IsArray, ValidateNested, IsInt, Min, Allow } from 'class-validator';
import { Type } from 'class-transformer';

/** One answer for a single question (identified by zero-based index). */
export class AnswerItemDto {
  /** Zero-based index of the question in the quiz's `questions` array. */
  @IsInt()
  @Min(0)
  questionIndex: number;

  /**
   * The user's answer:
   *  - multiple_choice → number (option index)
   *  - fill_blank      → string
   *
   * `@Allow()` is required so the ValidationPipe's `whitelist: true` keeps this
   * property; without a decorator it would be stripped (a union of number|string
   * can't be expressed with a single validation constraint).
   */
  @Allow()
  answer: number | string;
}

export class SubmitQuizDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerItemDto)
  answers: AnswerItemDto[];
}
