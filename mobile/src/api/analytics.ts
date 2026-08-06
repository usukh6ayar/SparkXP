import { apiRequest } from './client';

/** Full learner snapshot (GET /api/analytics/overview). Read-only aggregation
 *  — the backend derives these from existing activity, no new tracking. */
export interface AnalyticsOverview {
  study: { totalMinutes: number; todayMinutes: number; weekMinutes: number; monthMinutes: number };
  lessons: { completed: number; total: number; completionRate: number };
  practice: { sessions: number; completed: number };
  vocabulary: { learned: number; reviewed: number; mastered: number };
  buddy: { sessions: number; minutes: number; voiceMinutes: number; textMessages: number };
  gamification: {
    xp: number;
    sparksEarned: number;
    stars: number;
    currentStreak: number;
    longestStreak: number;
  };
}

/** One day in the activity chart. */
export interface AnalyticsDay {
  date: string; // YYYY-MM-DD
  xp: number;
  studyMinutes: number;
}

export interface AnalyticsHistory {
  range: 'week' | 'month';
  days: AnalyticsDay[];
}

/** GET /analytics/overview — the profile stats block. */
export function getAnalyticsOverview(token: string): Promise<AnalyticsOverview> {
  return apiRequest<AnalyticsOverview>('/analytics/overview', { token });
}

/** GET /analytics/history — per-day series for the weekly/monthly chart. */
export function getAnalyticsHistory(
  token: string,
  range: 'week' | 'month',
): Promise<AnalyticsHistory> {
  return apiRequest<AnalyticsHistory>(`/analytics/history?range=${range}`, { token });
}
