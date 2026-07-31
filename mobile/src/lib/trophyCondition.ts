import { t, tf, type TranslationKey } from '../i18n';
import type { TrophyCondition } from '../api/achievements';

/**
 * Turns a backend `TrophyCondition` into the human sentence shown under a
 * locked trophy ("7 хоног дараалан суралцах").
 *
 * The rules themselves live server-side (`backend/src/achievements/conditions.ts`)
 * — this only phrases them, so a new condition type needs a line here plus its
 * i18n key. Unknown types fall back to "coming soon" rather than rendering a
 * raw enum at the user.
 */

/** Condition types that are just `stat >= value` → one `{n}` template each. */
const SIMPLE: Record<string, TranslationKey> = {
  xp_total: 'condXpTotal',
  sparks_total: 'condSparksTotal',
  streak_days: 'condStreakDays',
  trophy_count: 'condTrophyCount',
  words_learned: 'condWordsLearned',
  words_mature: 'condWordsMature',
  words_saved: 'condWordsSaved',
  cards_swiped: 'condCardsSwiped',
  mistakes_fixed: 'condMistakesFixed',
  buddy_distinct: 'condBuddyDistinct',
};

/** Translate an enum-ish value via a `prefix_value` key, else return it raw. */
function label(prefix: string, value: string | undefined): string | null {
  if (!value) return null;
  const key = `${prefix}${value}` as TranslationKey;
  const text = t(key);
  // `t` returns the key itself when missing — don't show that to the user.
  return text === key ? value : text;
}

/** One-line Mongolian description of how a trophy is unlocked. */
export function describeCondition(condition: TrophyCondition | null): string {
  if (!condition) return t('trophyComingSoon');

  const n = condition.value;

  const simple = SIMPLE[condition.type];
  if (simple) return tf(simple, { n });

  switch (condition.type) {
    case 'xp_events': {
      const what = label('xpSrc_', condition.source);
      // No label for this source — fall back to the plain XP wording.
      return what ? tf('condXpEvents', { what, n }) : tf('condXpTotal', { n });
    }
    case 'quiz_count':
    case 'quiz_perfect': {
      const skill = label('skill_', condition.skill);
      const perfect = condition.type === 'quiz_perfect';
      if (skill) {
        return tf(perfect ? 'condQuizPerfectSkill' : 'condQuizCountSkill', { skill, n });
      }
      return tf(perfect ? 'condQuizPerfect' : 'condQuizCount', { n });
    }
    case 'buddy_sessions': {
      const mode = label('buddyMode_', condition.mode);
      return mode
        ? tf('condBuddySessionsMode', { mode, n })
        : tf('condBuddySessions', { n });
    }
    default:
      return t('trophyComingSoon');
  }
}

/** Display name for a tier, e.g. `gold` → "Алт". */
export function tierLabel(tier: string): string {
  return label('trophyTier_', tier) ?? tier;
}
