/**
 * SM-2 spaced-repetition algorithm (pure, no DB) — easy to unit-test.
 *
 * The learner rates each recall with a `quality` 0–5:
 *   5 perfect · 4 correct (small hesitation) · 3 correct (hard) ·
 *   2 wrong (familiar) · 1 wrong · 0 blackout
 * quality >= 3 counts as a successful recall.
 *
 * Reference: https://super-memory.com/english/ol/sm2.htm
 */

export interface Sm2State {
  /** Multiplier that grows the interval; starts at 2.5, floor 1.3. */
  easeFactor: number;
  /** Days until the next review after the last successful recall. */
  intervalDays: number;
  /** Consecutive successful recalls. */
  repetitions: number;
}

export interface Sm2Result extends Sm2State {
  /** When the card is next due. */
  nextReviewAt: Date;
}

/** Lowest quality still counted as a correct recall. */
export const PASS_THRESHOLD = 3;

/** SM-2 starting ease factor for a brand-new card. */
export const INITIAL_EASE_FACTOR = 2.5;

/**
 * Starting state for a word the learner has never reviewed. Used when creating
 * a fresh WordReview — TypeORM's `@Column` defaults only apply on DB insert,
 * not on `repository.create()`, so we set them explicitly here.
 */
export function initialSm2State(): Sm2State {
  return { easeFactor: INITIAL_EASE_FACTOR, intervalDays: 0, repetitions: 0 };
}

/**
 * Compute the next SM-2 state from the previous state and a quality rating.
 * `now` is injectable so tests can pin the date.
 */
export function computeSm2(
  prev: Sm2State,
  quality: number,
  now: Date = new Date(),
): Sm2Result {
  let { easeFactor, intervalDays, repetitions } = prev;

  if (quality >= PASS_THRESHOLD) {
    // Correct: advance the schedule.
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetitions += 1;
  } else {
    // Wrong: reset progress, review again tomorrow.
    repetitions = 0;
    intervalDays = 1;
  }

  // Adjust ease factor (applies on every review in standard SM-2).
  easeFactor =
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  const nextReviewAt = new Date(
    now.getTime() + intervalDays * 24 * 60 * 60 * 1000,
  );

  return { easeFactor, intervalDays, repetitions, nextReviewAt };
}
