import { resolveStreak, MAX_FROZEN_DAYS } from './gamification';

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
