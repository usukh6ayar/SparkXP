import type { TranslationKey } from '../i18n';
import type { LearningGoal, OnboardingLevel } from './onboardingAnswers';

/**
 * The "personalised plan" shown at the end of onboarding.
 *
 * This is a deliberate FRONTEND mapping, not a recommendation engine: the user
 * has no account yet, so there is nothing to ask the backend. It exists to show
 * that the answers were heard — the real curriculum still comes from
 * `GET /lessons`. Keep it a pure function so it stays trivially readable.
 */

export type PlanSkill = 'speaking' | 'vocabulary' | 'listening' | 'grammar';

export type PlanRow = { skill: PlanSkill; lessons: number; labelKey: TranslationKey };

/** Total stays 10 lessons/week whatever the answers — only the mix moves. */
const BASE: Record<PlanSkill, number> = { speaking: 3, vocabulary: 3, listening: 2, grammar: 2 };

/** `[skill that gains one, skill that gives one up]` per goal. */
const GOAL_SHIFT: Record<LearningGoal, [PlanSkill, PlanSkill]> = {
  daily: ['speaking', 'grammar'],
  career: ['speaking', 'listening'],
  travel: ['listening', 'grammar'],
  exam: ['grammar', 'speaking'],
  abroad: ['vocabulary', 'speaking'],
};

/** Beginners get more words, advanced learners more talking. */
const LEVEL_SHIFT: Partial<Record<OnboardingLevel, [PlanSkill, PlanSkill]>> = {
  a1: ['vocabulary', 'speaking'],
  unknown: ['vocabulary', 'speaking'],
  b2: ['speaking', 'vocabulary'],
};

const LABELS: Record<PlanSkill, TranslationKey> = {
  speaking: 'catSpeaking',
  vocabulary: 'skillVocabulary',
  listening: 'catListening',
  grammar: 'catGrammar',
};

/** Row order on screen — most-motivating skill first. */
const ORDER: PlanSkill[] = ['speaking', 'vocabulary', 'listening', 'grammar'];

export function weeklyPlan(goal: LearningGoal | null, level: OnboardingLevel | null): PlanRow[] {
  const mix = { ...BASE };

  // Apply each shift only while it leaves the donor with at least one lesson —
  // a plan row showing "0 хичээл" would read as a bug, not as personalisation.
  const shift = (pair?: [PlanSkill, PlanSkill]) => {
    if (!pair) return;
    const [up, down] = pair;
    if (mix[down] <= 1) return;
    mix[up] += 1;
    mix[down] -= 1;
  };

  shift(goal ? GOAL_SHIFT[goal] : undefined);
  shift(level ? LEVEL_SHIFT[level] : undefined);

  return ORDER.map((skill) => ({ skill, lessons: mix[skill], labelKey: LABELS[skill] }));
}
