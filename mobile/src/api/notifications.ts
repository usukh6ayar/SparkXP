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
