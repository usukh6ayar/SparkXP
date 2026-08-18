import { apiRequest } from './client';

/** Streak + level + today's XP for the gamification UI (GET /api/gamification). */
export interface Gamification {
  xp: number;
  level: number;
  levelXp: number;
  levelTarget: number;
  xpToNext: number;
  progress: number; // 0..1 through the current level
  currentStreak: number;
  longestStreak: number;
  /** Unused streak freezes the student holds. */
  streakFreezes: number;
  /**
   * Sparks price of one freeze / how many can be held.
   *
   * Optional because the backend does NOT send them yet — unlike hearts, whose
   * `HeartsState` carries `refillCost`. The price is plan-configurable
   * (`plans.streak_freeze_sparks`), so hardcoding it would break the rule that
   * plan limits change from admin without an app update. Requested from
   * Өсөхбаяр in `docs/REQUEST_choi_streak_freeze_cost.md`; until it lands we
   * fall back to STREAK_FREEZE_FALLBACK, which is what every plan resolves to
   * today (no plan sets the column).
   */
  streakFreezeCost?: number;
  maxStreakFreezes?: number;
  /**
   * How many freezes the CURRENT streak has already spent — i.e. how many
   * missed days it survived. Shown as "энэ streak-ийг 2 хоног хамгаалсан".
   *
   * Optional for older backends; when absent the UI simply omits that line.
   */
  streakFreezesUsed?: number;
  /**
   * Set on the first read of a day the streak advanced — show the celebration,
   * then POST /gamification/streak-seen so it never repeats. Optional so an
   * older backend (which omits it) simply never celebrates.
   */
  streakCelebration?: { streak: number; bonusXp: number } | null;
  todayXp: number;
  /** The student's chosen daily XP target — one of DAILY_GOAL_CHOICES. */
  dailyGoal: number;
  cefrLevel: string | null;
  lessonsDone: number;
  quizzesDone: number;
  /** Per-CEFR-level lesson progress for the Lessons map islands (a1…c2). */
  progressByLevel: Record<string, { done: number; total: number }>;
  /**
   * Per-CEFR-level star gate (castle unlock). `unlocked` is server-authoritative
   * — the map opens/locks an island by this, not by a local XP guess. Optional
   * so an older backend (without stars) simply falls back to "all open".
   */
  levelUnlocks?: Record<string, LevelUnlock>;
  /** Standalone exercises completed today for the Soril daily path. */
  todayExercises?: number;
  /** Exercises needed to fill the Soril daily path. */
  dailyExerciseGoal?: number;
}

/** One island's star gate on the Lessons map. */
export interface LevelUnlock {
  /** Stars earned inside this level's lessons. */
  starsEarned: number;
  /** Total stars (across all levels) needed to open this island. */
  starsRequired: number;
  /** Whether the user has enough stars to enter. */
  unlocked: boolean;
}

export function getGamification(token: string): Promise<Gamification> {
  return apiRequest<Gamification>('/gamification', { token });
}

/**
 * GET /gamification/stars — this user's earned stars per lesson (`{ [lessonId]:
 * 0..3 }`). Only lessons with ≥1 star appear; absent = 0 stars (empty).
 */
export function getLessonStars(token: string): Promise<Record<string, number>> {
  return apiRequest<Record<string, number>>('/gamification/stars', { token });
}

/** Detailed per-lesson stars (stars + best score + first-completed). */
export interface LessonStarDetail {
  lessonId: string;
  stars: number;
  bestScore: number;
  completedAt: string | null;
}

/** GET /lesson-stars — richer per-lesson rows (stars, bestScore, completedAt). */
export function getLessonStarsDetailed(token: string): Promise<LessonStarDetail[]> {
  return apiRequest<LessonStarDetail[]>('/lesson-stars', { token });
}

/** POST /lesson-result — record a lesson's test score directly → updated stars. */
export function postLessonResult(
  lessonId: string,
  score: number,
  token: string,
): Promise<LessonStarDetail> {
  return apiRequest<LessonStarDetail>('/lesson-result', {
    method: 'POST',
    body: { lessonId, score },
    token,
  });
}

/**
 * The three daily XP targets the picker offers, one per learner profile:
 *
 *  -  30 — **Сэргээх.** Already knows English, just keeping it warm. Roughly
 *          3 due SRS words (10 XP each) or 6 correct word-game answers.
 *  -  80 — **Тогтмол.** The ordinary student putting in a real daily shift:
 *          one lesson (15 XP) plus its test (~50 XP), or a review + game run.
 *  - 200 — **Эрчтэй.** The beginner who caught fire and binges: 3–4 lessons
 *          with their tests, or a full review queue.
 *
 * Why these are higher than the old 20 / 50 / 100: the old floor was ~30
 * seconds of work (20 XP = two review words), so "I kept my streak" carried no
 * information. Note that XP-per-minute is NOT constant — reading pays 15 XP for
 * ~5 minutes while the word game pays 5 XP per answer — so the minute figures in
 * the picker copy are a guide to intent, not a measurement.
 *
 * The backend validates against this list, so the picker UI and the request can
 * never drift apart.
 */
export const DAILY_GOAL_CHOICES = [30, 80, 200] as const;

export type DailyGoal = (typeof DAILY_GOAL_CHOICES)[number];

/**
 * Goals set by earlier builds (20 / 50 / 100) → the tier that replaced them.
 *
 * Existing users are deliberately NOT migrated: raising someone's bar mid-streak
 * would break a streak they were meeting fine. They keep their old number until
 * they open the picker themselves, so this map exists only to decide which row
 * to show as selected. The backend still accepts the legacy values for the same
 * reason (old app bundles are out there and would otherwise get a 400).
 */
const LEGACY_GOAL_TIERS: Record<number, DailyGoal> = { 20: 30, 50: 80, 100: 200 };

/**
 * Which picker row a user's current goal belongs to, or null when it matches no
 * tier at all (an unrecognised value — show nothing selected rather than lie).
 */
export function goalTier(current: number): DailyGoal | null {
  if ((DAILY_GOAL_CHOICES as readonly number[]).includes(current)) {
    return current as DailyGoal;
  }
  return LEGACY_GOAL_TIERS[current] ?? null;
}

/**
 * Free-tier streak-freeze rules, mirroring the backend's `STREAK_FREEZE_SPARKS`
 * and `MAX_HELD_FREEZES`. Used only while the API omits the real values — read
 * `streakFreezeCost` / `maxStreakFreezes` first, never these directly.
 */
export const STREAK_FREEZE_FALLBACK = { cost: 100, max: 2 } as const;

/**
 * POST /gamification/streak-freeze — buy one freeze with Sparks.
 * Throws `ApiError` 400 when the cap is reached or Sparks are short; the
 * backend's message is already Mongolian. Returns the refreshed summary.
 */
export function buyStreakFreeze(token: string): Promise<Gamification> {
  return apiRequest<Gamification>('/gamification/streak-freeze', {
    method: 'POST',
    token,
  });
}

/**
 * POST /gamification/streak-seen — call once the streak celebration has been
 * shown, so today's `streakCelebration` stops coming back.
 */
export function markStreakSeen(token: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>('/gamification/streak-seen', {
    method: 'POST',
    token,
  });
}

/** PATCH /gamification/goal — returns the refreshed gamification summary. */
export function setDailyGoal(
  dailyGoalXp: DailyGoal,
  token: string,
): Promise<Gamification> {
  return apiRequest<Gamification>('/gamification/goal', {
    method: 'PATCH',
    body: { dailyGoalXp },
    token,
  });
}

/** POST /gamification/daily-path/claim — once-per-day Soril path reward. */
export function claimDailyPath(
  token: string,
): Promise<{
  sparksAwarded: number;
  alreadyClaimed: boolean;
  todayExercises: number;
  dailyExerciseGoal: number;
}> {
  return apiRequest('/gamification/daily-path/claim', {
    method: 'POST',
    token,
  });
}
