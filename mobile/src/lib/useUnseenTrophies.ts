import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  getAchievements,
  markTrophiesSeen,
  type Trophy,
} from '../api/achievements';
import type { Achievement } from '../components/AchievementModal';
import { tints } from '../theme/theme';

/** Tier → badge ring colour. Unlisted tiers fall back to the brand purple. */
const TIER_TINT: Record<string, { bg: string; fg: string }> = {
  starter: tints.blue,
  bronze: tints.orange,
  silver: tints.blue,
  gold: tints.amber,
  sapphire: tints.blue,
  crystal: tints.green,
  ruby: tints.pink,
  emerald: tints.green,
  mythic: tints.purple,
  celestial: tints.amber,
};

// Same shape as Toast: the mounted host registers itself here and screens just
// fire, so no context plumbing is needed to reach the celebration from a
// finish screen deep in a stack.
let listener: (() => void) | null = null;

/**
 * Ask the server whether any new trophy was just won, and celebrate it.
 *
 * Call this at the end of every XP-earning flow (quiz result, lesson finish,
 * reading finish). Safe to call when nothing was won — it just no-ops.
 */
export function checkTrophies(): void {
  listener?.();
}

/**
 * Shows the unlock celebration for trophies the user has won but never seen.
 *
 * Trophies are awarded server-side after every XP award, so the app finds out
 * by asking: GET /achievements returns `unseen`. We show those one at a time
 * and POST /achievements/seen as each is dismissed, so a celebration is never
 * repeated — even across reinstalls, since "seen" lives in the database.
 *
 * Mount this once (see `TrophyHost`); screens trigger it via `checkTrophies()`.
 */
export function useUnseenTrophies() {
  const { token } = useAuth();
  const [queue, setQueue] = useState<Trophy[]>([]);
  // Guards against a second check() (e.g. two screens finishing at once)
  // re-adding a trophy that is already on screen or already dismissed.
  const handled = useRef(new Set<string>());

  const check = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getAchievements(token);
      if (!res.unseen.length) return;
      const fresh = res.trophies.filter(
        (tr) => res.unseen.includes(tr.slug) && !handled.current.has(tr.slug),
      );
      if (!fresh.length) return;
      fresh.forEach((tr) => handled.current.add(tr.slug));
      setQueue((q) => [...q, ...fresh]);
    } catch {
      // Offline or API down — celebrating late is fine, `unseen` is durable.
    }
  }, [token]);

  /** Dismiss the front trophy and tell the server it has been celebrated. */
  const dismiss = useCallback(() => {
    setQueue((q) => {
      const [shown, ...rest] = q;
      if (shown && token) {
        void markTrophiesSeen([shown.slug], token).catch(() => {
          // Failed to mark — it stays unseen and shows again next time. That's
          // the right failure direction: a repeat beats a silently lost unlock.
        });
      }
      return rest;
    });
  }, [token]);

  // Register as THE host and run one check on login, so trophies won by an
  // older build (or the backfill script) still get their moment.
  useEffect(() => {
    listener = () => void check();
    void check();
    return () => {
      listener = null;
    };
  }, [check]);

  const current = queue[0] ?? null;

  const achievement: Achievement | null = current
    ? {
        icon: 'trophy',
        title: current.name,
        tint: TIER_TINT[current.tier] ?? tints.purple,
        imageUrl: current.image,
      }
    : null;

  return { achievement, dismiss, check };
}
