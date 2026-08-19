import { apiRequest } from './client';

/**
 * The deep link a notification carries, so tapping it lands on the right
 * screen instead of just opening the app. Set by the backend; absent on older
 * rows and on plain admin broadcasts.
 */
export interface NotificationData {
  /** What produced it — drives the icon/colour without keyword-guessing. */
  type?: 'assignment' | 'broadcast' | 'review_due' | string;
  /** Expo Router href to open on tap, e.g. `/assignments`. */
  url?: string;
  assignmentId?: string;
}

/**
 * A notification shown to the student. Two kinds share this shape: an admin
 * broadcast (`targetRole` may narrow it to one role) and a personal one such
 * as "your teacher assigned homework". Named `AppNotification` to avoid
 * clashing with the global DOM `Notification` type.
 */
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  targetRole: string | null;
  createdAt: string;
  data?: NotificationData | null;
}

/**
 * Notifications targeting the current user (personal rows + role-matched and
 * global broadcasts), newest first. Backend: `GET /notifications/me`.
 */
export function getMyNotifications(token: string): Promise<AppNotification[]> {
  return apiRequest<AppNotification[]>('/notifications/me', { token });
}

// ── Push reminders ──────────────────────────────────────────────────────────
// The backend sends a daily 20:00 (UB) reminder naming how many words are due
// ("N үг чамайг хүлээж байна"), but only to devices that registered a token.
//
// The device side now lives in `src/lib/pushRegistration.ts`, wired into
// AuthContext (register on session start, drop on logout). `expo-notifications`
// IS installed and its plugin is in `app.json`.
//
// ⚠️ Still untestable in Expo Go — Expo removed remote push there in SDK 53, so
// these only do anything in a dev/production build. Delivery also needs a
// Firebase FCM V1 key uploaded to EAS: see `docs/PUSH_SETUP.md`.

/** Shape the backend enforces (`RegisterPushTokenDto`) — check before sending. */
export const EXPO_PUSH_TOKEN_RE = /^Expo(nent)?PushToken\[.+\]$/;

/**
 * POST /notifications/token — register this device. Idempotent, so it is safe
 * to call on every launch (the token can be reissued by the OS at any time).
 * A malformed token is rejected with 400.
 */
export function registerPushToken(
  pushToken: string,
  token: string,
): Promise<void> {
  return apiRequest<void>('/notifications/token', {
    method: 'POST',
    body: { token: pushToken },
    token,
  });
}

/** DELETE /notifications/token — on logout, or when the OS permission is revoked. */
export function deletePushToken(token: string): Promise<void> {
  return apiRequest<void>('/notifications/token', { method: 'DELETE', token });
}

/**
 * POST /notifications/prefs — turn reminders on/off from Settings. Keeps the
 * token registered, so switching back on needs no new permission prompt.
 */
export function setPushPrefs(enabled: boolean, token: string): Promise<void> {
  return apiRequest<void>('/notifications/prefs', {
    method: 'POST',
    body: { enabled },
    token,
  });
}
