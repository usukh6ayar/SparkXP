/**
 * Pure gamification helpers — streak day boundaries and XP→level curve.
 * No DB access, so they're easy to unit-test.
 */

/** Mongolia is UTC+8 (no DST), so the "day" rolls over at local midnight. */
const UB_OFFSET_MS = 8 * 60 * 60 * 1000;

/** The calendar day (YYYY-MM-DD) in Ulaanbaatar time for a given instant. */
export function dayKeyUB(date: Date = new Date()): string {
  return new Date(date.getTime() + UB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Start-of-day (UB) as a UTC Date — used to sum "today's" XP. */
export function startOfUBDay(date: Date = new Date()): Date {
  return new Date(`${dayKeyUB(date)}T00:00:00+08:00`);
}

/** The UB day key for `n` days before the given instant. */
export function dayKeyUBOffset(days: number, date: Date = new Date()): string {
  return dayKeyUB(new Date(date.getTime() + days * 24 * 60 * 60 * 1000));
}

export interface LevelInfo {
  level: number;
  /** XP earned within the current level. */
  levelXp: number;
  /** Total XP span of the current level. */
  levelTarget: number;
  /** XP still needed to reach the next level. */
  xpToNext: number;
  /** 0..1 progress through the current level. */
  progress: number;
}

/**
 * XP→level curve. Reaching level L costs a cumulative `50 * L * (L-1)` XP,
 * i.e. each level needs `100 * level` more XP than the previous — a gentle
 * Duolingo-style ramp. Level is always >= 1.
 */
export function computeLevel(xp: number): LevelInfo {
  const safeXp = Math.max(0, xp);
  const level = Math.max(1, Math.floor(0.5 + Math.sqrt(0.25 + safeXp / 50)));
  const cumulative = (l: number) => 50 * l * (l - 1);
  const start = cumulative(level);
  const end = cumulative(level + 1);
  const levelTarget = end - start;
  const levelXp = safeXp - start;
  return {
    level,
    levelXp,
    levelTarget,
    xpToNext: end - safeXp,
    progress: levelTarget > 0 ? levelXp / levelTarget : 0,
  };
}

/** Most consecutive missed days a stock of freezes can bridge. */
export const MAX_FROZEN_DAYS = 2;

/** Max freezes a learner may hold at once. */
export const MAX_HELD_FREEZES = 2;

export interface StreakInput {
  /** UB day key of the last active day, or null if never active. */
  lastActiveDate: string | null;
  currentStreak: number;
  /** Unused streak freezes the user owns. */
  freezes: number;
  /** Today's UB day key. */
  today: string;
}

/** Whole days between two YYYY-MM-DD keys (b - a). */
function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Decides the new streak on the first activity of a day, spending streak
 * freezes to bridge missed days where possible.
 *
 * Rules:
 *  - Active yesterday → streak continues, nothing spent.
 *  - Missed N days and holding ≥ N freezes (N ≤ MAX_FROZEN_DAYS) → spend N,
 *    streak continues as if unbroken.
 *  - Otherwise → streak resets to 1 and freezes are left untouched (we never
 *    burn freezes on a gap they cannot save).
 *
 * The MAX_FROZEN_DAYS cap stops someone banking freezes, disappearing for a
 * month, and returning with a "100-day streak" that means nothing.
 *
 * Pure on purpose — the DB-facing caller in XpService is hard to test, this is
 * not.
 */
export function resolveStreak(input: StreakInput): {
  streak: number;
  freezesLeft: number;
  freezesUsed: number;
} {
  const { lastActiveDate, currentStreak, freezes, today } = input;

  // Never active before, or same-day (caller already guards) → start at 1.
  if (!lastActiveDate) return { streak: 1, freezesLeft: freezes, freezesUsed: 0 };

  const gap = daysBetween(lastActiveDate, today);

  // Active yesterday → uninterrupted.
  if (gap <= 1) {
    return { streak: currentStreak + 1, freezesLeft: freezes, freezesUsed: 0 };
  }

  const missed = gap - 1;
  if (missed <= MAX_FROZEN_DAYS && freezes >= missed) {
    return {
      streak: currentStreak + 1,
      freezesLeft: freezes - missed,
      freezesUsed: missed,
    };
  }

  // Gap too wide (or not enough freezes) — reset, keep what they own.
  return { streak: 1, freezesLeft: freezes, freezesUsed: 0 };
}

/**
 * Whether a streak is still standing right now — i.e. whether meeting today's
 * goal would continue it rather than start a new one.
 *
 * The read path (Home / Profile) must agree with `resolveStreak`, which only
 * runs once the goal is met. Judging this on "active today or yesterday" alone
 * ignored freezes: after a missed day the app showed a 0 streak until the goal
 * was met, so the freeze the learner spent Sparks on looked like it had done
 * nothing. Same rules as `resolveStreak`, in read-only form.
 */
export function isStreakAlive(input: {
  lastActiveDate: string | null;
  today: string;
  freezes: number;
}): boolean {
  const { lastActiveDate, today, freezes } = input;
  if (!lastActiveDate) return false;

  const gap = daysBetween(lastActiveDate, today);
  if (gap <= 1) return true; // active today or yesterday

  const missed = gap - 1;
  return missed <= MAX_FROZEN_DAYS && freezes >= missed;
}

/**
 * Whether the app should still throw a streak celebration today.
 *
 * `lastActiveDate === today` only becomes true once the daily goal is met, so
 * it doubles as "the streak advanced today" — no extra state to keep in sync.
 * `seenDate` is what the app last reported as celebrated; `'error'` (an
 * unreadable store) counts as seen, because a modal that reappears on every
 * screen focus is worse than one that never appears.
 *
 * Pure on purpose — same reason as `resolveStreak` above.
 */
export function streakCelebrationDue(input: {
  lastActiveDate: string | null;
  today: string;
  seenDate: string | null;
  streak: number;
}): boolean {
  const { lastActiveDate, today, seenDate, streak } = input;
  if (lastActiveDate !== today || streak <= 0) return false;
  return seenDate !== today && seenDate !== 'error';
}
