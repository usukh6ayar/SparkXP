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

export interface PlanInfo {
  isFree: boolean;
  planName: string;
  expiresAt: string | null;
  limits: {
    voiceMinutes: number | null;
    sttMinutes: number | null;
    dictionaryAi: number | null;
    aiTextTokensK: number | null;
    memoryMb: number | null;
  } | null;
  usage: { voiceMinutes: number; sttMinutes: number; dictionaryAi: number; memoryMb: number };
}

/** GET /users/me/plan — current plan + usage for the profile plan card. */
export function getMyPlan(token: string): Promise<PlanInfo> {
  return apiRequest<PlanInfo>('/users/me/plan', { token });
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
