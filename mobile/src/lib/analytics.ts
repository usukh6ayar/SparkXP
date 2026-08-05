/**
 * Product analytics (PostHog).
 *
 * Nothing outside this file and `AnalyticsProvider` imports
 * `posthog-react-native` — screens call `track()`, so event names stay in the
 * union below instead of drifting into free-text strings scattered across the
 * app, and the privacy rules live in one place.
 *
 * **Off by default**, exactly like `monitoring.ts`: without
 * `EXPO_PUBLIC_POSTHOG_KEY` every function here is a no-op, so a teammate
 * without the key (`.env` is gitignored) sees no change and no errors. Dev
 * builds stay silent unless `EXPO_PUBLIC_ANALYTICS_IN_DEV=1`, so local clicking
 * around does not pollute the product numbers.
 *
 * **Privacy.** School students use this app. We send the user's UUID plus
 * coarse, non-identifying traits (role, CEFR level) — never email, username,
 * full name or location. Touch autocapture and session replay stay OFF (see
 * `AnalyticsProvider`), so no typed text or screen recording ever leaves the
 * device.
 */
import PostHog from 'posthog-react-native';
import { captureError } from './monitoring';

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim();
/** PostHog Cloud region — US is PostHog's default; EU is `https://eu.i.posthog.com`. */
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';

/** True when a project key is configured and this build is allowed to send. */
export const analyticsEnabled =
  !!KEY && (!__DEV__ || process.env.EXPO_PUBLIC_ANALYTICS_IN_DEV === '1');

/**
 * Values an event property may hold. Deliberately narrow — PostHog only accepts
 * JSON, and an accidental object/Date would silently serialise to junk.
 */
export type AnalyticsProps = Record<string, string | number | boolean | null>;

/**
 * Every event the app may send. A closed union, not `string`, so a typo is a
 * compile error rather than a second chart nobody notices is empty.
 *
 * Adding one: add the name here, then call `track()` from the screen that owns
 * the action. Keep names `object_verb_past_tense` and free of personal data.
 */
export type AnalyticsEvent =
  // Onboarding funnel — where first-run users drop off.
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_buddy_demo_completed'
  | 'onboarding_finished'
  // Account lifecycle.
  | 'signed_up'
  | 'logged_in'
  | 'logged_out';

/**
 * The client. Created once at import time when enabled; `null` otherwise, which
 * is what makes every function below a cheap no-op.
 */
export const posthog: PostHog | null = analyticsEnabled
  ? new PostHog(KEY as string, {
      host: HOST,
      // Lifecycle events (installed / opened / backgrounded) are the baseline
      // retention signal and cost nothing extra.
      captureAppLifecycleEvents: true,
      // Screen recording is off; turning it on would need a native build AND a
      // fresh privacy review, since lesson screens show student work.
      enableSessionReplay: false,
    })
  : null;

/** Record something the user did. Fire-and-forget — never blocks the UI. */
export function track(event: AnalyticsEvent, properties?: AnalyticsProps): void {
  posthog?.capture(event, properties);
}

/** Record a screen view. Called centrally by `AnalyticsProvider`. */
export function trackScreen(name: string, properties?: AnalyticsProps): void {
  posthog?.screen(name, properties);
}

/**
 * Tie the events collected so far to a real account.
 *
 * Traits are deliberately coarse — `role` and `level` answer "do teachers use
 * this differently?" without identifying anyone.
 */
export function identifyUser(
  userId: string,
  traits?: { role?: string; level?: string | null },
): void {
  posthog?.identify(userId, {
    ...(traits?.role ? { role: traits.role } : {}),
    ...(traits?.level ? { level: traits.level } : {}),
  });
}

/**
 * Forget the current identity on logout, so the next person to use the device
 * does not inherit the previous user's analytics profile.
 */
export function resetAnalytics(): void {
  posthog?.reset();
}

/**
 * Push anything still queued. Worth awaiting before a deliberate teardown
 * (logout) so the last events are not lost if the app is killed right after.
 */
export async function flushAnalytics(): Promise<void> {
  try {
    await posthog?.flush();
  } catch (err) {
    // A failed flush must never break the action that triggered it.
    captureError(err, { where: 'flushAnalytics' });
  }
}
