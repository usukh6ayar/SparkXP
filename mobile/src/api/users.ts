import { apiRequest } from './client';

export interface UserStats {
  xp: number;
  sparks: number;
}

export interface UpdateProfilePayload {
  fullName?: string;
  province?: string;
  district?: string;
}

export function getStats(token: string): Promise<UserStats> {
  return apiRequest<UserStats>('/users/me/stats', { token });
}

export function updateProfile(
  payload: UpdateProfilePayload,
  token: string,
) {
  return apiRequest('/users/me', { method: 'PATCH', body: payload, token });
}
