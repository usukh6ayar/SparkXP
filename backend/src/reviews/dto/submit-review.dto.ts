import { IsInt, Min, Max } from 'class-validator';

/**
 * Body for POST /api/reviews/:wordId. The learner rates their recall 0–5
 * (SM-2 quality). 3+ = correct. The mobile app can map buttons like
 * Again/Hard/Good/Easy onto these numbers.
 */
export class SubmitReviewDto {
  @IsInt()
  @Min(0)
  @Max(5)
  quality: number;
}
