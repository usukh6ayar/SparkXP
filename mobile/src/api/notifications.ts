import { apiRequest } from './client';

/**
 * A broadcast notification shown to the student (title/body announcement sent
 * from the admin panel). Named `AppNotification` to avoid clashing with the
 * global DOM `Notification` type.
 */
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  targetRole: string | null;
  createdAt: string;
}

/**
 * Notifications targeting the current user (role-matched + global broadcasts),
 * newest first. Backend: `GET /notifications/me` (Өсөхбаяр).
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
