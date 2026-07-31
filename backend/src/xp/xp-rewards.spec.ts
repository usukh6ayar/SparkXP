import { XP_REWARDS, loadRewards, streakXp } from './xp-rewards';

/**
 * The streak bonus is the one XP award that is computed rather than looked up,
 * and `loadRewards` sits in front of every award in the app — so a bug in
 * either silently changes the whole economy.
 */

/** Minimal ioredis stand-in: only `get` is used. */
const fakeRedis = (value: string | null | (() => never)) =>
  ({
    get: async () => {
      if (typeof value === 'function') value();
      return value;
    },
  }) as never;

describe('loadRewards', () => {
  it('returns the code defaults when nothing is overridden', async () => {
    expect(await loadRewards(fakeRedis(null))).toEqual(XP_REWARDS);
  });

  it('applies a PARTIAL override and keeps the rest', async () => {
    const rewards = await loadRewards(fakeRedis(JSON.stringify({ lesson: 25 })));
    expect(rewards.lesson).toBe(25);
    expect(rewards.reading).toBe(XP_REWARDS.reading);
  });

  it('falls back to defaults on unparseable JSON', async () => {
    expect(await loadRewards(fakeRedis('not json'))).toEqual(XP_REWARDS);
  });

  it('falls back to defaults when Redis throws', async () => {
    // A broken cache must never stop XP being awarded.
    const throwing = fakeRedis(() => {
      throw new Error('redis down');
    });
    expect(await loadRewards(throwing)).toEqual(XP_REWARDS);
  });
});

describe('streakXp', () => {
  it('scales with the streak', () => {
    expect(streakXp(1, XP_REWARDS)).toBe(XP_REWARDS.streakBase);
    expect(streakXp(3, XP_REWARDS)).toBe(XP_REWARDS.streakBase * 3);
  });

  it('caps so a long streak cannot dwarf real learning', () => {
    expect(streakXp(10_000, XP_REWARDS)).toBe(XP_REWARDS.streakMax);
  });

  it('never returns less than one period, even at streak 0', () => {
    // Day one is `resolveStreak` → 1, but guard against a 0 slipping through:
    // awarding 0 XP would make `award()` return null and look like a failure.
    expect(streakXp(0, XP_REWARDS)).toBe(XP_REWARDS.streakBase);
  });
});
