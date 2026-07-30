import { BuddySessionMode, XpSource } from '../common/enums';
import type { Skill } from '../teacher/skill';

/**
 * Trophy unlock rules — pure logic, no database. Mirrors `xp/gamification.ts`:
 * the DB-facing caller is hard to test, so the decision lives here where a spec
 * can cover every branch with plain objects.
 */

/** Every stat a condition can read. All counts are lifetime totals. */
export interface TrophyStats {
  xpTotal: number;
  sparksTotal: number;
  /** longest_streak, not current — a trophy earned is never taken back. */
  streakDays: number;
  trophyCount: number;
  /** xp_logs rows per source. Absent source = 0. */
  xpEvents: Partial<Record<XpSource, number>>;
  /** quiz_attempts rows. `total` = all skills. */
  quizCount: Partial<Record<Skill | 'total', number>>;
  /** quiz_attempts rows with score_pct = 100. */
  quizPerfect: Partial<Record<Skill | 'total', number>>;
  /** Distinct words with repetitions >= 1 (matches reviews.service.ts). */
  wordsLearned: number;
  /** Distinct words with interval_days >= 21 (matches teacher/progress.service.ts). */
  wordsMature: number;
  wordsSaved: number;
  /** SUM(review_count) — swipes, NOT distinct words. */
  cardsSwiped: number;
  /** Words the user got wrong at least once and has since learned. */
  mistakesFixed: number;
  /** buddy_sessions rows. `total` = both modes. */
  buddySessions: Partial<Record<BuddySessionMode | 'total', number>>;
  /** Distinct buddy_slug values the user has talked to. */
  buddyDistinct: number;
}

/** Stats that need no parameter — the condition is just `stat >= value`. */
export type SimpleConditionType =
  | 'xp_total'
  | 'sparks_total'
  | 'streak_days'
  | 'trophy_count'
  | 'words_learned'
  | 'words_mature'
  | 'words_saved'
  | 'cards_swiped'
  | 'mistakes_fixed'
  | 'buddy_distinct';

export type TrophyCondition =
  | { type: SimpleConditionType; value: number }
  | { type: 'xp_events'; source: XpSource; value: number }
  | { type: 'quiz_count' | 'quiz_perfect'; skill?: Skill; value: number }
  | { type: 'buddy_sessions'; mode?: BuddySessionMode; value: number };

export type ConditionType = TrophyCondition['type'];

/** Reads the single number a condition compares against `value`. */
function statFor(c: TrophyCondition, s: TrophyStats): number {
  switch (c.type) {
    case 'xp_total':
      return s.xpTotal;
    case 'sparks_total':
      return s.sparksTotal;
    case 'streak_days':
      return s.streakDays;
    case 'trophy_count':
      return s.trophyCount;
    case 'words_learned':
      return s.wordsLearned;
    case 'words_mature':
      return s.wordsMature;
    case 'words_saved':
      return s.wordsSaved;
    case 'cards_swiped':
      return s.cardsSwiped;
    case 'mistakes_fixed':
      return s.mistakesFixed;
    case 'buddy_distinct':
      return s.buddyDistinct;
    case 'xp_events':
      return s.xpEvents[c.source] ?? 0;
    case 'quiz_count':
      return s.quizCount[c.skill ?? 'total'] ?? 0;
    case 'quiz_perfect':
      return s.quizPerfect[c.skill ?? 'total'] ?? 0;
    case 'buddy_sessions':
      return s.buddySessions[c.mode ?? 'total'] ?? 0;
  }
}

/** True when the user has met this condition. */
export function evaluate(c: TrophyCondition, s: TrophyStats): boolean {
  return statFor(c, s) >= c.value;
}

/**
 * Conditions re-checked after EVERY award, whatever the source.
 *
 * `award()` bumps `users.xp` and may advance the streak on any source
 * (xp.service.ts:123-136) — and `XpSource.STREAK` is never actually passed by
 * any caller, so gating streak trophies on it would mean they never fire.
 * `trophy_count` belongs here too: earning one trophy can unlock another.
 */
export const ALWAYS_CHECKED: ConditionType[] = [
  'xp_total',
  'sparks_total',
  'streak_days',
  'trophy_count',
];

/**
 * Which condition types an XP source can move. Anything not listed is skipped,
 * so a quiz award never runs the vocabulary aggregates.
 */
export const TYPES_BY_SOURCE: Record<XpSource, ConditionType[]> = {
  [XpSource.QUIZ]: ['xp_events', 'quiz_count', 'quiz_perfect'],
  [XpSource.WORD_REVIEW]: [
    'xp_events',
    'words_learned',
    'words_mature',
    'words_saved',
    'cards_swiped',
    'mistakes_fixed',
  ],
  [XpSource.AI_BUDDY]: ['xp_events', 'buddy_sessions', 'buddy_distinct'],
  [XpSource.READING]: ['xp_events'],
  [XpSource.LESSON]: ['xp_events'],
  [XpSource.ASSIGNMENT]: ['xp_events'],
  [XpSource.REFERRAL]: ['xp_events'],
  [XpSource.ONBOARDING]: ['xp_events'],
  [XpSource.STREAK]: ['xp_events'],
};

/** The condition types worth evaluating after an award from `source`. */
export function typesForSource(source: XpSource): ConditionType[] {
  return [...new Set([...ALWAYS_CHECKED, ...(TYPES_BY_SOURCE[source] ?? [])])];
}
