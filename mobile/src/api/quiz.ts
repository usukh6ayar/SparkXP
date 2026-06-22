import { apiRequest } from './client';

/** One multiple-choice question from GET /api/words/quiz (no answer leaked). */
export interface QuizQuestion {
  wordId: string;
  english: string;
  phonetic: string | null;
  imageUrl: string | null;
  /** 4 shuffled Mongolian options — one is correct. */
  options: string[];
}

/** Result of POST /api/words/quiz/submit. */
export interface QuizResult {
  total: number;
  correct: number;
  xpAwarded: number;
  sparksAwarded: number;
}

/** GET /api/words/quiz?count= — generate a vocabulary quiz. */
export function getQuiz(token: string, count = 10): Promise<QuizQuestion[]> {
  return apiRequest<QuizQuestion[]>(`/words/quiz?count=${count}`, { token });
}

/** POST /api/words/quiz/submit — grade answers, award XP + Sparks. */
export function submitQuiz(
  token: string,
  answers: { wordId: string; choice: string }[],
): Promise<QuizResult> {
  return apiRequest<QuizResult>('/words/quiz/submit', {
    method: 'POST',
    body: { answers },
    token,
  });
}
