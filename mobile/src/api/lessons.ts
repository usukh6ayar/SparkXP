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
  const q = new URLSearchParams();
  if (params?.level) q.set('level', params.level);
  if (params?.type) q.set('type', params.type);
  q.set('isPublished', 'true');
  return apiRequest<{ items: Lesson[]; total: number }>(`/lessons?${q}`, { token });
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
