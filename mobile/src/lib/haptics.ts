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
 *   haptics.error();    // wrong answer, validation error
 *   haptics.select();   // option / segment change
 */
import * as Haptics from 'expo-haptics';

/** Light tap — default button / general press feedback. */
const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

/** Medium tap — a heavier confirmation (e.g. unlocking a lesson). */
const medium = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

/** Success notification — correct answer, XP earned, task complete. */
const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

/** Warning notification — soft "not quite" (e.g. "review" swipe). */
const warning = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

/** Error notification — wrong answer, failed validation. */
const error = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

/** Selection tick — moving between options / segments / tabs. */
const select = () => Haptics.selectionAsync();

export const haptics = { tap, medium, success, warning, error, select };
