import { apiRequest } from './client';

/** A word inside a review (subset of the Word entity the UI needs). */
export interface ReviewWord {
  id: string;
  english: string;
  mongolian: string;
  exampleSentence: string | null;
}

/** A due review row from GET /api/reviews/due (WordReview + its word). */
export interface DueReview {
  id: string;
  wordId: string;
  word: ReviewWord;
}

/** Words the user is due to review now. */
export function getDue(token: string): Promise<DueReview[]> {
  return apiRequest<DueReview[]>('/reviews/due', { token });
}

/**
 * Submit a recall attempt. `quality` is SM-2 0–5 (3+ = correct). The backend
 * creates the WordReview on first submit, so this also "starts" a new word.
 */
export function submitReview(token: string, wordId: string, quality: number) {
  return apiRequest(`/reviews/${wordId}`, {
    method: 'POST',
    body: { quality },
    token,
  });
}

/** A word in the swipe-learning deck. */
export interface LearnWord {
  id: string;
  english: string;
  mongolian: string;
  exampleSentence: string | null;
}

/** GET /api/reviews/learn — words not yet known (swipe deck). */
export function getLearnQueue(token: string): Promise<LearnWord[]> {
  return apiRequest<LearnWord[]>('/reviews/learn', { token });
}

export interface ReviewStats {
  known: number; // мэдэх үгийн тоо
  learning: number;
}

/** GET /api/reviews/stats — { known, learning } for the profile counter. */
export function getReviewStats(token: string): Promise<ReviewStats> {
  return apiRequest<ReviewStats>('/reviews/stats', { token });
}

/** Swipe right = "I know it" → quality 5 (advances SM-2 → counts as known). */
export function markKnown(token: string, wordId: string) {
  return submitReview(token, wordId, 5);
}

