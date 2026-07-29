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
  todayXp: number;
  /** The student's chosen daily XP target — one of DAILY_GOAL_CHOICES. */
  dailyGoal: number;
  cefrLevel: string | null;
  lessonsDone: number;
  quizzesDone: number;
  /** Per-CEFR-level lesson progress for the Lessons map islands (a1…c2). */
  progressByLevel: Record<string, { done: number; total: number }>;
}

export function getGamification(token: string): Promise<Gamification> {
  return apiRequest<Gamification>('/gamification', { token });
}

/**
 * The only daily XP targets the backend accepts (`SetDailyGoalDto` rejects
 * anything else with a 400). Kept here so the picker UI and the request can
 * never drift apart.
 */
export const DAILY_GOAL_CHOICES = [20, 50, 100] as const;

export type DailyGoal = (typeof DAILY_GOAL_CHOICES)[number];

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
