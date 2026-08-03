import { apiRequest } from './client';

/**
 * Trophies / achievements. Mirrors `backend/src/achievements/` — the catalog
 * (100 badges over 10 tiers) lives on the server, so the app never hardcodes a
 * badge list. Trophies are awarded server-side after every XP award; the client
 * only reads them and marks unlock celebrations as shown.
 */

/** Low → high. The server sends this order in `tiers`; use that, not this list. */
export type TrophyTier =
  | 'starter'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'sapphire'
  | 'crystal'
  | 'ruby'
  | 'emerald'
  | 'mythic'
  | 'celestial';

/** Lifetime stat a trophy is unlocked by. Mirrors `achievements/conditions.ts`. */
export type TrophyConditionType =
  | 'xp_total'
  | 'sparks_total'
  | 'streak_days'
  | 'trophy_count'
  | 'words_learned'
  | 'words_mature'
  | 'words_saved'
  | 'cards_swiped'
  | 'mistakes_fixed'
  | 'buddy_distinct'
  | 'xp_events'
  | 'quiz_count'
  | 'quiz_perfect'
  | 'buddy_sessions';

/**
 * `stat >= value`. The optional keys narrow which stat is read and only appear
 * on their own type (`source` on xp_events, `skill` on quiz_*, `mode` on
 * buddy_sessions) — absent means "any".
 */
export interface TrophyCondition {
  type: TrophyConditionType;
  value: number;
  source?: string;
  skill?: string;
  mode?: string;
}

export interface Trophy {
  /** Stable id; also the key stored in `user_trophies` and used for images. */
  slug: string;
  tier: TrophyTier;
  /** English by design — trophy names are not localized. */
  name: string;
  /** null = not trackable yet; show it as "coming soon". */
  condition: TrophyCondition | null;
  /** ~87KB WebP, 640px. Detail view and unlock celebration ONLY. */
  image: string;
  /** ~19KB WebP, 256px. Use this for every grid and list. */
  thumb: string;
  earned: boolean;
  /** ISO date, or null when not earned. */
  earnedAt: string | null;
}

export interface AchievementsResponse {
  /** Tier display order, low → high. */
  tiers: TrophyTier[];
  total: number;
  earned: number;
  /** Earned but never celebrated — show these, then POST /achievements/seen. */
  unseen: string[];
  /** Slugs pinned to the profile, in display order (max MAX_PINNED). */
  pinned: string[];
  trophies: Trophy[];
}

/** How many trophies may be pinned to the profile (mirrors the backend cap). */
export const MAX_PINNED = 5;

/** The GET path — also the `useSWR` cache key, so keep the two in sync. */
export const ACHIEVEMENTS_PATH = '/achievements';

/** GET /achievements — full catalog with this user's earned flags. */
export function getAchievements(token: string): Promise<AchievementsResponse> {
  return apiRequest<AchievementsResponse>(ACHIEVEMENTS_PATH, { token });
}

/**
 * POST /achievements/seen — call after showing the unlock celebration so it is
 * never shown twice. Omit `slugs` to clear every outstanding one.
 */
export function markTrophiesSeen(
  slugs: string[] | undefined,
  token: string,
): Promise<{ updated: number }> {
  return apiRequest<{ updated: number }>('/achievements/seen', {
    method: 'POST',
    body: slugs?.length ? { slugs } : {},
    token,
  });
}

/**
 * POST /achievements/pinned — send the WHOLE pinned set, in display order.
 *
 * Replace-the-set (not pin-one) keeps the order unambiguous and the call
 * idempotent. Rejects with `ApiError` 400 if more than MAX_PINNED slugs are
 * sent or any of them isn't earned; the message is already Mongolian.
 */
export function setPinnedTrophies(
  slugs: string[],
  token: string,
): Promise<{ pinned: string[] }> {
  return apiRequest<{ pinned: string[] }>('/achievements/pinned', {
    method: 'POST',
    body: { slugs },
    token,
  });
}
