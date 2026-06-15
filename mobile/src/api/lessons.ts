import { apiRequest } from './client';

export interface Lesson {
  id: string;
  title: string;
  description: string | null;
  type: string;
  level: string;
  content: Record<string, unknown>;
  position: number;
  isPublished: boolean;
  priceSparks: number;
}

export interface LessonAccess {
  hasAccess: boolean;
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

export function unlockLesson(id: string, token: string): Promise<LessonUnlock> {
  return apiRequest<LessonUnlock>(`/lessons/${id}/unlock`, {
    method: 'POST',
    token,
  });
}
