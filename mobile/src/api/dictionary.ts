import { apiRequest } from './client';

/**
 * One block of the richer AI dictionary explanation (Premium plan doc §2):
 * most-common meaning, common/secondary, special case, phrase/expression.
 */
export interface DictionarySection {
  /** Section heading, e.g. "Most common", "Phrase / expression". */
  title: string;
  /** Mongolian explanation for this section. */
  body: string;
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
   * Optional 4-part detailed explanation. The backend only returns the short
   * `translation` today; when Өсөхбаяр ships the fuller Gemini explanation the
   * popover renders these sections automatically (see DictionaryProvider).
   */
  sections?: DictionarySection[];
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
