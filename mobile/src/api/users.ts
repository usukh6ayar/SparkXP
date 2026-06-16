import { apiRequest, apiUpload } from './client';
import type { AuthUser } from './auth';

export interface UserStats {
  xp: number;
  sparks: number;
}

export interface UpdateProfilePayload {
  fullName?: string;
  province?: string;
  district?: string;
  /** Image URL or a `default:avN` key. */
  avatarUrl?: string;
}

export function getStats(token: string): Promise<UserStats> {
  return apiRequest<UserStats>('/users/me/stats', { token });
}

export function updateProfile(
  payload: UpdateProfilePayload,
  token: string,
): Promise<AuthUser> {
  return apiRequest<AuthUser>('/users/me', { method: 'PATCH', body: payload, token });
}

/** Upload a custom avatar image from the device → returns the updated user. */
export function uploadAvatar(uri: string, token: string): Promise<AuthUser> {
  const name = uri.split('/').pop() || 'avatar.jpg';
  const ext = (name.split('.').pop() || 'jpg').toLowerCase();
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return apiUpload<AuthUser>('/users/me/avatar', { uri, name, type }, token);
}
