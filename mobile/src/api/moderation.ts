import { apiRequest } from './client';

export type ReportReason = 'photo' | 'name' | 'other';

/** A user the current user blocked (Тохиргоо → Блоклосон хэрэглэгчид). */
export interface BlockedUser {
  userId: string;
  fullName: string;
  username: string | null;
  avatarUrl: string | null;
}

/** POST /users/:id/report — flags their photo/name for the admin team. */
export function reportUser(userId: string, reason: ReportReason, token: string): Promise<void> {
  return apiRequest<void>(`/users/${userId}/report`, { method: 'POST', body: { reason }, token });
}

/** POST /users/:id/block — they disappear from this user's leaderboards. */
export function blockUser(userId: string, token: string): Promise<void> {
  return apiRequest<void>(`/users/${userId}/block`, { method: 'POST', token });
}

export function unblockUser(userId: string, token: string): Promise<void> {
  return apiRequest<void>(`/users/${userId}/block`, { method: 'DELETE', token });
}

export function getBlockedUsers(token: string): Promise<BlockedUser[]> {
  return apiRequest<BlockedUser[]>('/users/me/blocks', { token });
}
