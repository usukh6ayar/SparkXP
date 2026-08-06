import { IsUUID, IsInt, Min, Max } from 'class-validator';

/** POST /lesson-result — record a lesson's test score → stars. */
export class LessonResultDto {
  @IsUUID()
  lessonId: string;

  /** Test score as a percentage (0–100). */
  @IsInt()
  @Min(0)
  @Max(100)
  score: number;
}
