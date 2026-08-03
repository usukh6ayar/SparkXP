import {
  resolveStreak,
  streakCelebrationDue,
  MAX_FROZEN_DAYS,
} from './gamification';

/**
 * Streak resolution decides whether a learner keeps or loses their streak —
 * the number they care about most. Getting it wrong either destroys streaks
 * unfairly or hands out streaks nobody earned, and neither throws an error.
 */
describe('resolveStreak', () => {
  const base = { currentStreak: 10, freezes: 0, today: '2026-07-28' };

  it('starts at 1 for a brand-new learner', () => {
    expect(resolveStreak({ ...base, lastActiveDate: null, currentStreak: 0 })).toEqual({
      streak: 1,
      freezesLeft: 0,
      freezesUsed: 0,
    });
  });

  it('continues the streak when yesterday was active', () => {
    expect(resolveStreak({ ...base, lastActiveDate: '2026-07-27' })).toEqual({
      streak: 11,
      freezesLeft: 0,
      freezesUsed: 0,
    });
  });

  it('resets to 1 after a missed day with no freezes', () => {
    expect(resolveStreak({ ...base, lastActiveDate: '2026-07-26' })).toEqual({
      streak: 1,
      freezesLeft: 0,
      freezesUsed: 0,
    });
  });

  it('spends one freeze to bridge a single missed day', () => {
    expect(
      resolveStreak({ ...base, lastActiveDate: '2026-07-26', freezes: 1 }),
    ).toEqual({ streak: 11, freezesLeft: 0, freezesUsed: 1 });
  });

  it('spends two freezes to bridge two missed days', () => {
    expect(
      resolveStreak({ ...base, lastActiveDate: '2026-07-25', freezes: 2 }),
    ).toEqual({ streak: 11, freezesLeft: 0, freezesUsed: 2 });
  });

  it('does NOT burn freezes on a gap they cannot save', () => {
    // 2 days missed but only 1 freeze → streak is lost anyway, so the freeze
    // must survive rather than being wasted.
    const r = resolveStreak({ ...base, lastActiveDate: '2026-07-25', freezes: 1 });
    expect(r.streak).toBe(1);
    expect(r.freezesLeft).toBe(1);
    expect(r.freezesUsed).toBe(0);
  });

  it('refuses to bridge a gap wider than the cap, however many freezes are held', () => {
    // Banking freezes then vanishing must not preserve a meaningless streak.
    const r = resolveStreak({ ...base, lastActiveDate: '2026-06-01', freezes: 99 });
    expect(r.streak).toBe(1);
    expect(r.freezesUsed).toBe(0);
    expect(MAX_FROZEN_DAYS).toBeLessThan(30);
  });

  it('handles a month boundary correctly', () => {
    // 2026-06-30 → 2026-07-01 is consecutive, not a 29-day gap.
    expect(
      resolveStreak({ ...base, lastActiveDate: '2026-06-30', today: '2026-07-01' }),
    ).toEqual({ streak: 11, freezesLeft: 0, freezesUsed: 0 });
  });
});

/**
 * The gate on the once-a-day streak celebration. A false positive here means a
 * modal that pops up on every screen focus, which is worse than no modal —
 * hence the deliberately conservative reading of an unavailable "seen" store.
 */
describe('streakCelebrationDue', () => {
  const base = { today: '2026-07-28', streak: 5 };

  it('fires on the day the streak advanced, before it has been shown', () => {
    expect(
      streakCelebrationDue({ ...base, lastActiveDate: '2026-07-28', seenDate: null }),
    ).toBe(true);
  });

  it('stays quiet once today has been marked as seen', () => {
    expect(
      streakCelebrationDue({ ...base, lastActiveDate: '2026-07-28', seenDate: '2026-07-28' }),
    ).toBe(false);
  });

  it('fires again the next day, even though yesterday was seen', () => {
    expect(
      streakCelebrationDue({ ...base, lastActiveDate: '2026-07-28', seenDate: '2026-07-27' }),
    ).toBe(true);
  });

  it('stays quiet when the goal has not been met today', () => {
    // The streak is alive (yesterday) but has not advanced yet today.
    expect(
      streakCelebrationDue({ ...base, lastActiveDate: '2026-07-27', seenDate: null }),
    ).toBe(false);
  });

  it('treats an unreadable seen-store as already seen', () => {
    expect(
      streakCelebrationDue({ ...base, lastActiveDate: '2026-07-28', seenDate: 'error' }),
    ).toBe(false);
  });

  it('never celebrates a zero streak', () => {
    expect(
      streakCelebrationDue({ ...base, streak: 0, lastActiveDate: '2026-07-28', seenDate: null }),
    ).toBe(false);
  });
});
