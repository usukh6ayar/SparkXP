import { apiRequest } from './client';

export type Period = 'weekly' | 'monthly' | 'all_time';
export type Scope = 'global' | 'province' | 'district' | 'organization' | 'teacher';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  fullName: string;
  username: string | null;
  avatarUrl: string | null;
  province: string | null;
  district: string | null;
  xp: number;
}

export interface LeaderboardResult {
  period: string;
  scope: string;
  entries: LeaderboardEntry[];
  me: { rank: number | null; xp: number };
}

/** GET /api/leaderboard?period=&scope= — top N by XP + the current user's rank. */
export function getLeaderboard(
  token: string,
  period: Period,
  scope: Scope,
): Promise<LeaderboardResult> {
  return apiRequest<LeaderboardResult>(
    `/leaderboard?period=${period}&scope=${scope}`,
    { token },
  );
}
