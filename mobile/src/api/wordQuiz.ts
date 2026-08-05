import { apiRequest } from './client';

/** One multiple-choice question from GET /api/words/quiz (no answer leaked). */
export interface QuizQuestion {
  wordId: string;
  english: string;
  phonetic: string | null;
  imageUrl: string | null;
  /** Pronunciation audio — used by the "Сонсож барь" (listen) game mode. */
  audioUrl: string | null;
  /** 4 shuffled Mongolian options — one is correct. */
  options: string[];
}

/** One graded answer, so the result screen can say WHICH word went wrong. */
export interface QuizAnswerResult {
  wordId: string;
  correct: boolean;
  /** The word's Mongolian meaning — what the student should have picked. */
  correctAnswer: string;
}

/** Result of POST /api/words/quiz/submit. */
export interface QuizResult {
  total: number;
  correct: number;
  xpAwarded: number;
  sparksAwarded: number;
  /**
   * Per-answer grading, newest backends only.
   *
   * The server already computes this to count the score, it just used to throw
   * it away — so a student finished a vocabulary game knowing only "7/10", with
   * no way to learn which three words they don't know yet.
   *
   * **Optional on purpose:** an app that ships ahead of the backend simply hides
   * the review instead of crashing. See ROADMAP → "Өсөхбаяр — BE хүсэлт".
   */
  results?: QuizAnswerResult[];
}

/** GET /api/words/quiz?count= — generate a vocabulary quiz. */
export function getQuiz(token: string, count = 10): Promise<QuizQuestion[]> {
  return apiRequest<QuizQuestion[]>(`/words/quiz?count=${count}`, { token });
}

/** One word↔meaning pair for the "Холбож ял" (match) game. */
export interface MatchPair {
  wordId: string;
  english: string;
  mongolian: string;
}

/** GET /api/words/match?count= — word↔meaning pairs for the match game. */
export function getMatchPairs(token: string, count = 5): Promise<MatchPair[]> {
  return apiRequest<MatchPair[]>(`/words/match?count=${count}`, { token });
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
