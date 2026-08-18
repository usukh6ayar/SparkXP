import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DailyGoal } from '../api/gamification';

/**
 * What the hybrid onboarding flow learns about a brand-new user, before they
 * have an account (so none of it can be stored server-side yet).
 *
 * It is kept on the DEVICE rather than in route params because the flow is a
 * multi-route stack: pressing back re-mounts a screen, and the user may wander
 * off to login and come back. `app/(auth)/onboarding/_layout.tsx` holds it in
 * context for the live session; this module is the copy that survives an app
 * kill, and the one `register.tsx` reads to prefill / apply the answers.
 */

/** Why the user is learning — drives the weekly plan mix (see onboardingPlan). */
export type LearningGoal = 'daily' | 'career' | 'travel' | 'exam' | 'abroad';

/**
 * Self-assessed level. `'unknown'` is deliberately NOT a CEFR value: the
 * placement step in registration still has to ask for a real one, so it maps
 * back to `undefined` (see `levelForRegister`).
 */
export type OnboardingLevel = 'a1' | 'a2' | 'b1' | 'b2' | 'unknown';

/** Minutes-per-day the user committed to. */
export type DailyMinutes = 5 | 10 | 15 | 20;

export type OnboardingAnswers = {
  goal: LearningGoal | null;
  level: OnboardingLevel | null;
  dailyMinutes: DailyMinutes;
  completedBuddyDemo: boolean;
  earnedDemoXp: number;
};

/** 10 minutes is pre-selected — the flow's recommended commitment. */
export const DEFAULT_ANSWERS: OnboardingAnswers = {
  goal: null,
  level: null,
  dailyMinutes: 10,
  completedBuddyDemo: false,
  earnedDemoXp: 0,
};

/**
 * Steps in the flow (welcome → goal → level → minutes → buddy demo → plan →
 * account) — the denominator in the "3 / 7" progress indicator.
 */
export const ONBOARDING_TOTAL_STEPS = 7;

const KEY = 'onboarding_answers';

export async function saveAnswers(answers: OnboardingAnswers): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(answers));
  } catch {
    // Non-critical: the in-memory context still drives the current run.
  }
}

export async function loadAnswers(): Promise<OnboardingAnswers> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_ANSWERS;
    // Spread over the defaults so a stored blob written by an older build
    // (missing a field) can never produce `undefined` where code expects a value.
    return { ...DEFAULT_ANSWERS, ...(JSON.parse(raw) as Partial<OnboardingAnswers>) };
  } catch {
    return DEFAULT_ANSWERS;
  }
}

/** Clear once the answers have been handed to the backend at registration. */
export async function clearAnswers(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Non-critical.
  }
}

/**
 * The CEFR value registration should pre-select, or `undefined` when the user
 * said they don't know — the placement step must still make them choose.
 */
export function levelForRegister(level: OnboardingLevel | null): string | undefined {
  return level && level !== 'unknown' ? level : undefined;
}

/**
 * Minutes → the daily XP goal the backend accepts (`DAILY_GOAL_CHOICES` =
 * 30 / 80 / 200). The app measures the goal in XP, not minutes, so the four
 * onboarding choices collapse onto three values.
 *
 * 10 and 15 minutes deliberately share the 80 XP goal rather than 15 reaching
 * for 200. XP-per-minute swings wildly by activity (reading pays 15 XP for a
 * five-minute passage; the word game pays 5 XP per answer), so 200 XP is only a
 * 15-minute day if you spend it in the fastest-paying screen. Setting a bar the
 * learner misses costs them the streak they were promised, so where the mapping
 * is ambiguous it errs low — the 20-minute pick is the one that asked for the
 * binge tier.
 */
export const MINUTES_TO_DAILY_XP: Record<DailyMinutes, DailyGoal> = {
  5: 30,
  10: 80,
  15: 80,
  20: 200,
};
