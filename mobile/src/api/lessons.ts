import { apiRequest } from './client';

export interface Lesson {
  id: string;
  title: string;
  description: string | null;
  type: string;
  level: string;
  thumbnailUrl: string | null;
  content: Record<string, unknown>;
  position: number;
  isPublished: boolean;
  priceSparks: number;
}

/**
 * Whether this student may watch a lesson, and why.
 *
 * The server owns the rule — the app only renders it. `freeRemaining` /
 * `freeQuota` are `null` while the free-lesson quota is switched off
 * (`FREE_LESSON_QUOTA_ENABLED`), which is the case until QPay ships; the UI
 * must show no counter at all then rather than guessing a number.
 */
export interface LessonAccess {
  hasAccess: boolean;
  /** 'plan' | 'unlocked' | 'assignment' | 'free_lesson' | 'locked' */
  reason?: string;
  /** True when `openLesson()` would succeed — homework, or a right to spend. */
  canOpen?: boolean;
  freeRemaining?: number | null;
  freeQuota?: number | null;
}

export interface LessonUnlock {
  id: string;
  lessonId: string;
  sparksSpent: number;
}

export function getLessons(token: string, params?: { level?: string; type?: string }): Promise<{ items: Lesson[]; total: number }> {
  // Plain query string — React Native's URLSearchParams is unreliable.
  let url = '/lessons?isPublished=true';
  if (params?.level) url += `&level=${params.level}`;
  if (params?.type) url += `&type=${params.type}`;
  return apiRequest<{ items: Lesson[]; total: number }>(url, { token });
}

export function getLesson(id: string, token: string): Promise<Lesson> {
  return apiRequest<Lesson>(`/lessons/${id}`, { token });
}

export function checkAccess(id: string, token: string): Promise<LessonAccess> {
  return apiRequest<LessonAccess>(`/lessons/${id}/access`, { token });
}

/**
 * POST /lessons/:id/open — the "Эхлэх" tap. Grants access, spending one of the
 * three free rights unless the lesson is teacher-assigned homework (always
 * free). Idempotent on the server, so a double tap cannot cost two rights.
 */
export function openLesson(id: string, token: string): Promise<LessonAccess> {
  return apiRequest<LessonAccess>(`/lessons/${id}/open`, {
    method: 'POST',
    token,
  });
}

export function unlockLesson(id: string, token: string): Promise<LessonUnlock> {
  return apiRequest<LessonUnlock>(`/lessons/${id}/unlock`, {
    method: 'POST',
    token,
  });
}

/** Home "Continue learning" target + real progress through its level (C1). */
export interface ContinueLearning {
  /** Next unfinished lesson, or `null` when every lesson is done. */
  lesson: Pick<Lesson, 'id' | 'title' | 'thumbnailUrl' | 'type' | 'level'> | null;
  level: string | null;
  levelDone: number;
  levelTotal: number;
  allCompleted: boolean;
}

export function getContinue(token: string): Promise<ContinueLearning> {
  return apiRequest<ContinueLearning>('/lessons/continue', { token });
}

/** Lesson ids the student has finished — the level trail ticks nodes BY ID
 *  (counting "the first N" put checkmarks on the wrong lessons). */
export function getCompletedLessonIds(token: string): Promise<{ ids: string[] }> {
  return apiRequest<{ ids: string[] }>('/lessons/completed', { token });
}

/** Mark a lesson complete → awards XP once. Idempotent on the server. */
export function completeLesson(
  id: string,
  token: string,
): Promise<{ lessonId: string; alreadyCompleted: boolean; xpAwarded: number }> {
  return apiRequest(`/lessons/${id}/complete`, { method: 'POST', token });
}
