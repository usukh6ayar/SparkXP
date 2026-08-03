import { apiRequest } from './client';

/**
 * One sense of a searched word: the Толь format. No title, no definition —
 * just the word (or phrase), an English example and its Mongolian translation.
 */
export interface WordSense {
  word: string;
  example: string;
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
}

/** GET /api/dictionary/search/:word result — up to 4 senses, most common first. */
export interface SensesResult {
  word: string;
  senses: WordSense[];
  cached: boolean;
}

/** One row of the user's ⭐ dictionary list. */
export interface SavedDictionaryWord {
  word: string;
  /** Cached senses, or null when the word was starred from the reader. */
  senses: WordSense[] | null;
  /** One-line subtitle: short gloss, else the first sense's translation. */
  translation: string;
}

/**
 * GET /api/dictionary/search/:word — the Толь search result (max 4 senses).
 * Backend order: dictionary_entries cache → Gemini (cached after).
 */
export function searchWord(token: string, word: string): Promise<SensesResult> {
  return apiRequest<SensesResult>(
    `/dictionary/search/${encodeURIComponent(word)}`,
    { token },
  );
}

/**
 * GET /api/dictionary/:word — short Mongolian meaning of an English word
 * (reader double-tap). Backend: Word DB → translation cache → Gemini.
 */
export function lookupWord(token: string, word: string): Promise<WordLookup> {
  return apiRequest<WordLookup>(`/dictionary/${encodeURIComponent(word)}`, { token });
}

/**
 * POST /api/dictionary/translate — full Mongolian translation of an English
 * sentence/phrase (not a 1–4 word gloss).
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

/** GET /api/dictionary/saves — the user's ⭐ dictionary words. */
export function getDictionarySaves(token: string): Promise<SavedDictionaryWord[]> {
  return apiRequest<SavedDictionaryWord[]>('/dictionary/saves', { token });
}

/**
 * POST /api/dictionary/saves/:word — toggle ⭐. Unlike the old
 * `/dictionary/:word/save`, this never creates a row in the curated word bank.
 */
export function toggleDictionarySave(
  token: string,
  word: string,
): Promise<{ word: string; saved: boolean }> {
  return apiRequest<{ word: string; saved: boolean }>(
    `/dictionary/saves/${encodeURIComponent(word)}`,
    { method: 'POST', token },
  );
}
