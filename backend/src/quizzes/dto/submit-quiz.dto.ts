import { IsArray, ValidateNested, IsInt, Min, Allow, IsOptional, IsUUID } from 'class-validator';
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

  /** When the student is fulfilling an assignment, its id (links the attempt). */
  @IsOptional()
  @IsUUID()
  assignmentId?: string;
}

/**
 * `POST /quizzes/:id/check`-ийн бие — нэг хариу + сонголтоор даалгаврын id.
 *
 * `assignmentId` яагаад хэрэгтэй вэ: багш нэг тестээс 5 асуулт сонгож өгсөн
 * бол сурагчийн харж буй 3 дахь асуулт нь эх тестийн 3 дахь асуулт БИШ.
 * Сервер энэ id-гаар мөнөөх дэд олонлогийг сэргээж, ижил шүүгдсэн quiz дээр
 * шалгадаг тул индекс нь таарна.
 *
 * ⚠️ Энэ нь итгэмжлэл биш: сервер тухайн даалгавар үнэхээр энэ сурагчийнх
 * бөгөөд энэ quiz руу заасан эсэхийг шалгана. Зүрх/XP-ийн шийдвэр нь
 * урьдын адил `isAssignedWork()`-оос гардаг — client-ийн үгнээс биш.
 */
export class CheckAnswerDto extends AnswerItemDto {
  @IsOptional()
  @IsUUID()
  assignmentId?: string;
}
