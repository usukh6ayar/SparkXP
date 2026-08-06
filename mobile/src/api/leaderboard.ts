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
  /** Only set for the `teacher` scope: a class the student is in (for deep-linking
   *  to their progress screen). null/undefined for other scopes. */
  classId?: string | null;
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

/** GET /api/leaderboard/preview — top N (default 3) weekly/global for the Home
 *  preview card. Lighter than the full board (no `me`, no scope math). */
export function getLeaderboardPreview(
  token: string,
  limit = 3,
): Promise<LeaderboardEntry[]> {
  return apiRequest<LeaderboardEntry[]>(`/leaderboard/preview?limit=${limit}`, { token });
}
