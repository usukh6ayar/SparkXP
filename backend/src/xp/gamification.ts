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
