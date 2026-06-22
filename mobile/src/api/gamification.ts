import { apiRequest } from './client';

/** Streak + level + today's XP for the gamification UI (GET /api/gamification). */
export interface Gamification {
  xp: number;
  level: number;
  levelXp: number;
  levelTarget: number;
  xpToNext: number;
  progress: number; // 0..1 through the current level
  currentStreak: number;
  longestStreak: number;
  todayXp: number;
  dailyGoal: number;
  cefrLevel: string | null;
  lessonsDone: number;
  quizzesDone: number;
}

export function getGamification(token: string): Promise<Gamification> {
  return apiRequest<Gamification>('/gamification', { token });
}
