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
// Getting the token itself needs `expo-notifications`, which is NOT installed —
// dependency + `app.json` plugin changes belong to the lead (CLAUDE.md), and
// Expo Go dropped remote push in SDK 53 so it can't be tested here either.
// Requested in `docs/REQUEST_choi_push_notifications.md`. These wrappers are
// ready for the moment that lands.

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
