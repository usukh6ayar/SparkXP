import { IsArray, ValidateNested, IsInt, Min } from 'class-validator';
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
   */
  answer: number | string;
}

export class SubmitQuizDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerItemDto)
  answers: AnswerItemDto[];
}
