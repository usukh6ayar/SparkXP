import { XpService } from './xp.service';
import { XpSource } from '../common/enums';
import { XP_REWARDS, streakXp } from './xp-rewards';
import { dayKeyUB, dayKeyUBOffset } from './gamification';

/**
 * The daily-goal streak bonus is paid by calling `award()` from inside
 * `award()`. That is a recursion, and the only thing between it and an infinite
 * loop is the guard in the post-commit block — so it gets its own test.
 *
 * Everything is faked; this exercises the control flow, not SQL.
 */

interface Row {
  userId: string;
  amount: number;
  source: XpSource;
  referenceId: string | null;
}

/**
 * Builds an XpService whose fake DB behaves like the real one in the ways that
 * matter: XP accumulates, and `lastActiveDate` is written when the streak
 * advances (which is what stops a second bonus).
 */
function makeService(opts: { dailyGoalXp?: number; startingTodayXp?: number } = {}) {
  const rows: Row[] = [];
  const user = {
    id: 'u1',
    xp: 0,
    currentStreak: 3,
    longestStreak: 3,
    // Active yesterday → the streak continues (3 → 4) rather than resetting.
    lastActiveDate: dayKeyUBOffset(-1),
    streakFreezes: 0,
    dailyGoalXp: opts.dailyGoalXp ?? 50,
  };
  let todayXp = opts.startingTodayXp ?? 0;

  const manager = {
    create: (_e: unknown, data: Row) => data,
    save: async (row: Row) => {
      rows.push(row);
      todayXp += row.amount;
      return row;
    },
    increment: async (_e: unknown, _w: unknown, _c: string, by: number) => {
      user.xp += by;
    },
    findOne: async () => ({ ...user }),
    update: async (_e: unknown, _w: unknown, patch: Record<string, unknown>) => {
      Object.assign(user, patch);
    },
    createQueryBuilder: () => ({
      select: () => manager.createQueryBuilder(),
      where: () => manager.createQueryBuilder(),
      andWhere: () => manager.createQueryBuilder(),
      getRawOne: async () => ({ sum: String(todayXp) }),
    }),
  };

  const svc = new XpService(
    // xpLogs repo — only awardOnce's duplicate lookup uses it.
    { findOne: async ({ where }: { where: Row }) =>
        rows.find(
          (r) =>
            r.userId === where.userId &&
            r.source === where.source &&
            r.referenceId === where.referenceId,
        ) ?? null,
    } as never,
    {} as never, // users repo (unused on this path)
    {} as never, // lessons repo
    { transaction: async (fn: (m: typeof manager) => unknown) => fn(manager) } as never,
    {} as never, // sparks
    { checkAfterXp: async () => [] } as never,
    { get: async () => null } as never, // redis → code default rewards
  );

  return { svc, rows, user };
}

describe('daily-goal streak bonus', () => {
  it('pays exactly one bonus when the goal is crossed, and does not recurse', async () => {
    const { svc, rows, user } = makeService({ dailyGoalXp: 50 });

    await svc.award({ userId: 'u1', amount: 50, source: XpSource.LESSON });

    const streakRows = rows.filter((r) => r.source === XpSource.STREAK);
    expect(streakRows).toHaveLength(1);
    expect(streakRows[0].amount).toBe(streakXp(4, XP_REWARDS)); // 3 → 4
    // Keyed on the day, which is what makes a same-day repeat a no-op.
    expect(streakRows[0].referenceId).toBe(dayKeyUB());
    expect(user.lastActiveDate).toBe(dayKeyUB());
  });

  it('does not pay a second bonus on the next award the same day', async () => {
    const { svc, rows } = makeService({ dailyGoalXp: 50 });

    await svc.award({ userId: 'u1', amount: 50, source: XpSource.LESSON });
    await svc.award({ userId: 'u1', amount: 30, source: XpSource.READING });

    expect(rows.filter((r) => r.source === XpSource.STREAK)).toHaveLength(1);
  });

  it('pays nothing while the daily goal is still unmet', async () => {
    const { svc, rows, user } = makeService({ dailyGoalXp: 50 });

    await svc.award({ userId: 'u1', amount: 10, source: XpSource.WORD_REVIEW });

    expect(rows.filter((r) => r.source === XpSource.STREAK)).toHaveLength(0);
    expect(user.lastActiveDate).toBe(dayKeyUBOffset(-1)); // streak untouched
  });

  it('a STREAK award can never trigger another one', async () => {
    // The load-bearing guard: without the `source !== STREAK` check this is the
    // shape that loops forever, since a big bonus also crosses the goal.
    const { svc, rows } = makeService({ dailyGoalXp: 10 });

    await svc.award({ userId: 'u1', amount: 999, source: XpSource.STREAK });

    expect(rows.filter((r) => r.source === XpSource.STREAK)).toHaveLength(1);
  });
});
