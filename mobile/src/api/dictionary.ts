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
   * that sense — most common first, never random. Filled by `searchWord()`
   * (the dictionary panel). Absent on the reader popover's `lookupWord()`,
   * which deliberately stays a single short gloss, so the panel's fallback to
   * `translation` is still the live path there.
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

/** One row of the user's ⭐ dictionary list. */
export interface SavedDictionaryWord {
  word: string;
  /** Cached senses, or null when the word was starred from the reader. */
  senses: DictionarySense[] | null;
  /** One-line subtitle: short gloss, else the first sense's translation. */
  translation: string;
}

/**
 * GET /api/dictionary/search/:word — the Толь search result: up to MAX_SENSES
 * senses, most-used first. Backend: `dictionary_entries` cache → Gemini
 * (cached forever after). This is what fills `WordLookup.meanings`.
 */
export function searchWord(
  token: string,
  word: string,
): Promise<{ word: string; senses: DictionarySense[]; cached: boolean }> {
  return apiRequest(`/dictionary/search/${encodeURIComponent(word)}`, { token });
}

/** GET /api/dictionary/saves — the user's ⭐ dictionary words. */
export function getDictionarySaves(token: string): Promise<SavedDictionaryWord[]> {
  return apiRequest<SavedDictionaryWord[]>('/dictionary/saves', { token });
}

/**
 * POST /api/dictionary/saves/:word — toggle ⭐.
 *
 * Replaces the old `POST /dictionary/:word/save`, which created a
 * `needs_review` row in the curated word bank and polluted the admin panel.
 * This one writes to `user_dictionary_saves` and touches nothing else.
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
