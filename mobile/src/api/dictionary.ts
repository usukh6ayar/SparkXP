import { apiRequest } from './client';

/** At most this many senses are shown for one word. */
export const MAX_SENSES = 4;

/**
 * One sense of an English word — deliberately just three lines, no definitions
 * or grammar labels: the word (or phrase) it is used as, an English example,
 * and that example's Mongolian translation. Learners read usage, not glossary
 * entries.
 */
export interface DictionarySense {
  /** The word or phrase form of this sense, e.g. "run" or "run out of". */
  word: string;
  /** English example sentence. */
  example: string;
  /** Mongolian translation of `example`. */
  translation: string;
}

export interface WordLookup {
  /** The looked-up word, normalised to lowercase by the backend. */
  word: string;
  /** Short Mongolian meaning. */
  translation: string;
  /** Pronunciation audio URL if already generated, else null. */
  audioUrl: string | null;
  /** True when served from the Words DB / cache (free), false when from AI. */
  cached: boolean;
  /**
   * Up to `MAX_SENSES` senses ordered by how often the word is really used in
   * that sense — most common first, never random. Optional: the backend
   * returns only the short `translation` today, and the panel falls back to it
   * until Өсөхбаяр ships this field.
   */
  meanings?: DictionarySense[];
}

/**
 * GET /api/dictionary/:word — short Mongolian meaning of an English word.
 * Backend order: Word DB → translation cache → Gemini (cached after).
 */
export function lookupWord(token: string, word: string): Promise<WordLookup> {
  return apiRequest<WordLookup>(`/dictionary/${encodeURIComponent(word)}`, { token });
}

/**
 * POST /api/dictionary/translate — full Mongolian translation of an English
 * sentence/phrase (not a 1–4 word gloss). Backend: translation cache → Gemini
 * with a sentence-tuned prompt, cached after. (Endpoint owned by Өсөхбаяр.)
 */
export function translateSentence(
  token: string,
  text: string,
): Promise<{ translation: string }> {
  return apiRequest<{ translation: string }>('/dictionary/translate', {
    method: 'POST',
    body: { text },
    token,
  });
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
