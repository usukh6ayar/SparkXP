/**
 * Crash / error reporting + performance tracing (Sentry).
 *
 * Nothing outside this file imports `@sentry/react-native` — screens and
 * services call `captureError()` so the provider can be swapped, and so the
 * privacy rules below live in exactly one place.
 *
 * **Off by default.** Without `EXPO_PUBLIC_SENTRY_DSN` the whole module is
 * inert: `.env` is gitignored, so a teammate who pulls this branch without the
 * key gets an app that behaves exactly as before rather than one that crashes
 * on boot or spams a stranger's Sentry project. Dev builds also stay silent
 * unless `EXPO_PUBLIC_MONITORING_IN_DEV=1`, so local noise never buries a real
 * production crash.
 *
 * **Expo Go.** The native SDK does not exist there, so native crash handling
 * and frame tracking are switched off (`isRunningInExpoGo()`); JavaScript
 * errors are still captured. Choi/Boju test in Expo Go — this must never throw.
 *
 * **Privacy.** This app is used by school students. `sendDefaultPii` stays
 * false and `beforeSend` strips anything identifying: Sentry only ever learns
 * a user's UUID, never their email, username or IP.
 */
import { isRunningInExpoGo } from 'expo';
import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

/** Sample rate for performance traces in production (0–1). */
const PROD_TRACES_RATE = Number(process.env.EXPO_PUBLIC_SENTRY_TRACES_RATE ?? '0.2');

const inExpoGo = isRunningInExpoGo();

/** True when a DSN is configured and this build is allowed to report. */
export const monitoringEnabled =
  !!DSN && (!__DEV__ || process.env.EXPO_PUBLIC_MONITORING_IN_DEV === '1');

/**
 * Navigation instrumentation — turns each screen change into a performance
 * transaction (screen load time, slow renders, the API calls a screen makes).
 *
 * This is the stand-in for EAS Observe, which needs Expo SDK 55 and so cannot
 * be used while the project is pinned to SDK 54 (CLAUDE.md, 2026-08-04).
 * It must be created at module scope so `_layout.tsx` can hand it the router's
 * container ref on mount.
 */
export const navigationIntegration = Sentry.reactNavigationIntegration({
  // Time-to-initial-display needs the native layer.
  enableTimeToInitialDisplay: !inExpoGo,
});

/**
 * Start Sentry. Call once, at module scope in the root layout — before the
 * first render, or early boot crashes are missed.
 */
export function initMonitoring(): void {
  if (!monitoringEnabled) return;

  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? 'development' : 'production',
    // Never attach IP / cookies / request bodies automatically.
    sendDefaultPii: false,
    // Sampling every trace in production is expensive and rarely more
    // informative; dev sends everything so a change can be verified at once.
    tracesSampleRate: __DEV__ ? 1.0 : PROD_TRACES_RATE,
    integrations: [navigationIntegration],
    // Native-only features — absent in Expo Go, where enabling them warns on
    // every launch and breaks the JS-only fallback.
    enableNative: !inExpoGo,
    enableNativeFramesTracking: !inExpoGo,
    beforeSend: stripPii,
  });

  Sentry.setTag('expo-go', String(inExpoGo));
}

/**
 * Attach (or clear) the signed-in user, so a crash can be traced to one
 * account. **The UUID only** — see the privacy note at the top of the file.
 */
export function setMonitoringUser(userId: string | null): void {
  if (!monitoringEnabled) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

/**
 * Report a handled error. Use this instead of a bare `console.error` for
 * anything the user experienced as a failure.
 *
 * `context` is free-form debugging detail (which screen, which id) — never put
 * personal data in it.
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!monitoringEnabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/**
 * Leave a trail of what happened before a crash (navigation, API calls).
 * Breadcrumbs are only sent when an error actually occurs.
 */
export function addTrace(message: string, data?: Record<string, unknown>): void {
  if (!monitoringEnabled) return;
  Sentry.addBreadcrumb({ message, data, level: 'info' });
}

/**
 * Wrap the root component so Sentry can see render errors and app-start
 * timing. Safe to call when monitoring is off — it is a passthrough then.
 */
export const wrapRoot = Sentry.wrap;

/**
 * Last line of defence for the privacy rule: drop identifying fields even if
 * some future code path sets them by accident.
 */
function stripPii(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.user) {
    delete event.user.email;
    delete event.user.username;
    delete event.user.ip_address;
  }
  return event;
}
