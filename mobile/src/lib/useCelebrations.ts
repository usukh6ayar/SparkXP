import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  getAchievements,
  markTrophiesSeen,
  type Trophy,
} from '../api/achievements';
import { getGamification, markStreakSeen, type Gamification } from '../api/gamification';
import type { Achievement } from '../components/AchievementModal';
import { t, tf } from '../i18n';
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

/**
 * One thing to celebrate. `kind` decides which endpoint marks it as shown, so
 * the queue can mix streaks and trophies without the host caring.
 */
type Celebration =
  | { kind: 'streak'; achievement: Achievement }
  | { kind: 'trophy'; slug: string; achievement: Achievement };

// Same shape as Toast: the mounted host registers itself here and screens just
// fire, so no context plumbing is needed to reach the celebration from a
// finish screen deep in a stack.
let listener: (() => void) | null = null;

/**
 * Ask the server whether anything was just won — a new trophy, or today's
 * daily-goal streak — and celebrate it.
 *
 * Call this at the end of every XP-earning flow (quiz result, lesson finish,
 * reading finish, review finish). Safe to call when nothing was won — it just
 * no-ops.
 */
export function checkCelebrations(): void {
  listener?.();
}

/**
 * Shows the celebrations the user has earned but never seen.
 *
 * Both sources are server-owned so a celebration is never repeated or lost,
 * even across reinstalls: trophies come back in `GET /achievements → unseen`,
 * and the streak comes back in `GET /gamification → streakCelebration` until
 * its endpoint is told it was shown.
 *
 * When both land on the same day (the 2/7/30-day streak trophies), the streak
 * shows first and the trophy second — one queue, never two modals at once.
 *
 * Mount this once (see `CelebrationHost`); screens fire `checkCelebrations()`.
 */
export function useCelebrations() {
  const { token } = useAuth();
  const [queue, setQueue] = useState<Celebration[]>([]);
  // Guards against a second check() (e.g. two screens finishing at once, or a
  // stale /gamification cache) re-adding something already on screen or
  // already dismissed.
  const handled = useRef(new Set<string>());

  const check = useCallback(async () => {
    if (!token) return;
    // Both in parallel: the streak must be ordered before the trophies, so it
    // can't be a separate hook racing the same modal.
    const [gam, ach] = await Promise.all([
      getGamification(token).catch(() => null),
      getAchievements(token).catch(() => null),
    ]);

    const fresh: Celebration[] = [];

    const streak = gam?.streakCelebration;
    if (streak && !handled.current.has(streakKey(streak.streak))) {
      handled.current.add(streakKey(streak.streak));
      fresh.push({ kind: 'streak', achievement: streakAchievement(streak, gam!) });
    }

    for (const tr of ach?.trophies ?? []) {
      if (!ach!.unseen.includes(tr.slug) || handled.current.has(tr.slug)) continue;
      handled.current.add(tr.slug);
      fresh.push({ kind: 'trophy', slug: tr.slug, achievement: trophyAchievement(tr) });
    }

    if (fresh.length) setQueue((q) => [...q, ...fresh]);
  }, [token]);

  /** Dismiss the front celebration and tell the server it has been shown. */
  const dismiss = useCallback(() => {
    setQueue((q) => {
      const [shown, ...rest] = q;
      if (shown && token) {
        const mark =
          shown.kind === 'streak'
            ? markStreakSeen(token)
            : markTrophiesSeen([shown.slug], token);
        void mark.catch(() => {
          // Failed to mark — it stays unseen and shows again next time. That's
          // the right failure direction: a repeat beats a silently lost unlock.
        });
      }
      return rest;
    });
  }, [token]);

  // Register as THE host and run one check on login, so anything won by an
  // older build (or the backfill script) still gets its moment.
  useEffect(() => {
    listener = () => void check();
    void check();
    return () => {
      listener = null;
    };
  }, [check]);

  return { achievement: queue[0]?.achievement ?? null, dismiss, check };
}

/** A streak number is reached once, so it doubles as the de-dup key. */
const streakKey = (streak: number) => `streak:${streak}`;

/**
 * "Your streak reached N." The number goes IN the badge — it is the whole
 * point of the moment — and the freeze line below answers the question the
 * celebration always raises next: what happens if I miss tomorrow?
 */
function streakAchievement(
  streak: { streak: number; bonusXp: number },
  gam: Gamification,
): Achievement {
  return {
    icon: 'flame',
    overline: t('streakCelebrationOverline'),
    badgeValue: String(streak.streak),
    title: t('streakCelebrationExtended'),
    subtitle: tf('streakCelebrationBonus', { n: streak.bonusXp }),
    tint: tints.orange,
    ...freezeNote(gam),
  };
}

/**
 * The freeze line for the streak card. Prefers the concrete fact ("this streak
 * has already survived N missed days") when the backend reports it, and
 * otherwise states the cover the student is holding. Says nothing at all when
 * there is neither — an empty chip is worse than no chip.
 */
function freezeNote(gam: Gamification): Pick<Achievement, 'note' | 'noteIcon'> {
  const used = gam.streakFreezesUsed ?? 0;
  const held = gam.streakFreezes ?? 0;
  if (used > 0) return { note: tf('streakFreezeUsedNote', { n: used }), noteIcon: 'snow' };
  if (held > 0) return { note: tf('streakFreezeCoverNote', { n: held }), noteIcon: 'snow-outline' };
  return {};
}

function trophyAchievement(trophy: Trophy): Achievement {
  return {
    icon: 'trophy',
    title: trophy.name,
    tint: TIER_TINT[trophy.tier] ?? tints.purple,
    imageUrl: trophy.image,
  };
}
