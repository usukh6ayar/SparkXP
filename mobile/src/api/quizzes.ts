import { apiRequest } from './client';

export interface QuizQuestion {
  type: 'multiple_choice' | 'fill_blank';
  question: string;
  options?: string[];   // multiple_choice only
  points: number;
  // correct & answer are NOT returned to the client (server-side only)
}

export interface Quiz {
  id: string;
  title: string;
  description: string | null;
  level: string;
  xpReward: number;
  isPublished: boolean;
  lessonId: string | null;
  category: string | null;
  questions: QuizQuestion[];
}

export interface AnswerItem {
  questionIndex: number;
  answer: number | string; // number = MC index, string = fill_blank
}

export interface QuizResult {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  xpEarned: number;
  breakdown: { questionIndex: number; correct: boolean; points: number }[];
}

export function getQuiz(id: string, token: string): Promise<Quiz> {
  return apiRequest<Quiz>(`/quizzes/${id}`, { token });
}

/** GET /api/quizzes — optionally filtered by lesson (for the lesson's test). */
export function getQuizzes(
  token: string,
  params: { lessonId?: string } = {},
): Promise<{ items: Quiz[]; total: number }> {
  const q = params.lessonId ? `?lessonId=${params.lessonId}` : '';
  return apiRequest<{ items: Quiz[]; total: number }>(`/quizzes${q}`, { token });
}

export function submitQuiz(
  id: string,
  answers: AnswerItem[],
  token: string,
): Promise<QuizResult> {
  return apiRequest<QuizResult>(`/quizzes/${id}/submit`, {
    method: 'POST',
    body: { answers },
    token,
  });
}
