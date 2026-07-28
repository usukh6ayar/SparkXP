/**
 * Tiny haptic-feedback helper — the ONE place the app talks to expo-haptics.
 *
 * Premium apps (Duolingo, Apple, Linear) give a small physical "tick" on every
 * key action; it is the cheapest, highest-impact source of the "delightful"
 * feel. Screens/components call these instead of importing expo-haptics
 * directly, so the whole app stays consistent (and we can globally disable or
 * swap the feedback from here later).
 *
 * Usage:
 *   import { haptics } from '../lib/haptics';
 *   haptics.tap();      // light press (buttons, tabs)
 *   haptics.success();  // correct answer, XP earned
 *   haptics.combo(3);   // streak reward with a stronger vibration pattern
 *   haptics.celebrate(); // lesson/exercise completion
 *   haptics.error();    // wrong answer, validation error
 *   haptics.select();   // option / segment change
 */
import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Budget Android phones often have no haptic motor (and web has no API at all),
 * so these calls reject. Feedback is a nice-to-have — swallow the rejection so
 * it never surfaces as an unhandled promise warning mid-lesson.
 */
const safe = (run: () => Promise<void>) => () => {
  run().catch(() => {});
};

function vibrate(pattern: number | number[]) {
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate(pattern);
  } catch {
    // Haptics are non-critical.
  }
}

function delayedImpact(style: Haptics.ImpactFeedbackStyle, delay: number) {
  setTimeout(() => {
    Haptics.impactAsync(style).catch(() => {});
  }, delay);
}

/** Light tap — default button / general press feedback. */
const tap = safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Medium tap — a heavier confirmation (e.g. unlocking a lesson). */
const medium = safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/** Success notification — correct answer, XP earned, task complete. */
const success = safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** Combo reward — stronger as the correct-answer streak grows. */
const combo = (run: number) => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  if (run >= 3) delayedImpact(Haptics.ImpactFeedbackStyle.Medium, 80);
  if (run >= 5) delayedImpact(Haptics.ImpactFeedbackStyle.Heavy, 160);
  vibrate(run >= 5 ? [0, 22, 28, 34, 34, 44] : run >= 3 ? [0, 18, 28, 34] : [0, 14]);
};

/** Completion reward — lesson watched, exercise finished, bigger XP moments. */
const celebrate = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  delayedImpact(Haptics.ImpactFeedbackStyle.Medium, 90);
  delayedImpact(Haptics.ImpactFeedbackStyle.Light, 170);
  vibrate([0, 20, 35, 40]);
};

/** Warning notification — soft "not quite" (e.g. "review" swipe). */
const warning = safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));

/** Error notification — wrong answer, failed validation. */
const error = safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

/** Selection tick — moving between options / segments / tabs. */
const select = safe(() => Haptics.selectionAsync());

export const haptics = { tap, medium, success, combo, celebrate, warning, error, select };
