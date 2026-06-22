import { apiRequest } from './client';

export interface WordExplanation {
  /** The looked-up word, normalised to lowercase by the backend. */
  word: string;
  /** Mongolian explanation (may contain simple **bold** / *italic* markdown). */
  explanation: string;
  /** True when served from the Words DB (free), false when from AI. */
  cached: boolean;
}

/**
 * GET /api/dictionary/:word — explain an English word in Mongolian.
 * Backend tries the Words DB first, then falls back to AI (plan-limited).
 */
export function lookupWord(token: string, word: string): Promise<WordExplanation> {
  return apiRequest<WordExplanation>(
    `/dictionary/${encodeURIComponent(word)}`,
    { token },
  );
}
