import { LeaderboardPeriod } from '../common/enums';

/**
 * Start of the date window for a leaderboard period, or `null` for all-time
 * (no lower bound). Leaderboards never reset XP — they just filter XpLog rows
 * by `created_at >= periodStart(...)`.
 *
 * Uses server local time. (Good enough for MVP; revisit if we need a fixed
 * Mongolia timezone.)
 */
export function periodStart(
  period: LeaderboardPeriod,
  now: Date = new Date(),
): Date | null {
  switch (period) {
    case LeaderboardPeriod.WEEKLY: {
      // Start of the current ISO week (Monday 00:00).
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      const mondayOffset = (d.getDay() + 6) % 7; // Sun=0 -> 6, Mon=1 -> 0, ...
      d.setDate(d.getDate() - mondayOffset);
      return d;
    }
    case LeaderboardPeriod.MONTHLY:
      // Start of the current calendar month.
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case LeaderboardPeriod.ALL_TIME:
    default:
      return null;
  }
}
