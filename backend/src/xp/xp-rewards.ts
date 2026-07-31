import type Redis from 'ioredis';

/**
 * Every fixed XP award in the app, in one place.
 *
 * These used to be six `const *_XP = 15` scattered across lessons, reading,
 * the AI buddy, auth and referrals — so tuning the economy meant editing six
 * files and shipping a release. CLAUDE.md's core rule is that this kind of
 * limit must be changeable without an app update, so they are overridable at
 * runtime from the Redis key `xp:rewards`, exactly like `hearts:defaults`:
 *
 *     redis-cli set xp:rewards '{"lesson":25,"reading":20}'
 *
 * A partial object is fine — anything absent keeps the default below.
 *
 * NOT here: quiz XP. That is `quiz.xpReward`, a per-quiz column the admin
 * panel already edits, which is the right model for content-specific rewards.
 */
export const XP_REWARDS = {
  lesson: 15,
  reading: 15,
  /** Once per AI buddy session, not per turn. */
  buddy: 10,
  /** Pre-signup taste-task bonus, granted on first email verify. */
  onboarding: 10,
  referralInviter: 50,
  referralInvitee: 50,
  /** Daily-goal streak bonus: `base * streak`, capped at `streakMax`. */
  streakBase: 5,
  streakMax: 50,
};

export type XpRewards = typeof XP_REWARDS;

/** Redis key holding a partial JSON override of XP_REWARDS. */
const REWARDS_KEY = 'xp:rewards';

/**
 * XP_REWARDS with any runtime override folded in. Falls back to the defaults
 * when Redis is unreachable or holds junk — a broken cache must never stop XP
 * being awarded.
 */
export async function loadRewards(redis: Redis): Promise<XpRewards> {
  try {
    const raw = await redis.get(REWARDS_KEY);
    if (raw) return { ...XP_REWARDS, ...(JSON.parse(raw) as Partial<XpRewards>) };
  } catch {
    // fall through to defaults
  }
  return XP_REWARDS;
}

/**
 * XP for extending a daily-goal streak. Grows with the streak so a long run is
 * worth protecting, but capped so it can't dwarf actual learning.
 */
export function streakXp(streak: number, rewards: XpRewards): number {
  return Math.min(rewards.streakBase * Math.max(streak, 1), rewards.streakMax);
}
