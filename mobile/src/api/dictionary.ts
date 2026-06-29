import { apiRequest } from './client';

export interface WordLookup {
  /** The looked-up word, normalised to lowercase by the backend. */
  word: string;
  /** Short Mongolian meaning. */
  translation: string;
  /** Pronunciation audio URL if already generated, else null. */
  audioUrl: string | null;
  /** True when served from the Words DB / cache (free), false when from AI. */
  cached: boolean;
}

/**
 * GET /api/dictionary/:word — short Mongolian meaning of an English word.
 * Backend order: Word DB → translation cache → Gemini (cached after).
 */
export function lookupWord(token: string, word: string): Promise<WordLookup> {
  return apiRequest<WordLookup>(`/dictionary/${encodeURIComponent(word)}`, { token });
}

/**
 * GET /api/dictionary/:word/audio — pronunciation audio URL (ElevenLabs).
 * Generated once on first request, then cached & reused.
 */
export function getWordAudio(
  token: string,
  word: string,
): Promise<{ audioUrl: string }> {
  return apiRequest<{ audioUrl: string }>(
    `/dictionary/${encodeURIComponent(word)}/audio`,
    { token },
  );
}

/**
 * POST /api/dictionary/:word/save — save the word (+ translation) to the user's
 * saved vocabulary (creates the Word as needs_review if it isn't in the bank).
 */
export function saveWord(
  token: string,
  word: string,
): Promise<{ wordId: string; saved: boolean }> {
  return apiRequest<{ wordId: string; saved: boolean }>(
    `/dictionary/${encodeURIComponent(word)}/save`,
    { method: 'POST', token },
  );
}
