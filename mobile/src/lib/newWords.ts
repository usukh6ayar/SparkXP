/**
 * "Шинэ үг" statistics for the Reading section.
 *
 * A passage's key vocabulary is the admin's own list of words worth learning.
 * The ones the reader has NOT collected yet (⭐ saved from the dictionary) are
 * the new ones — that is the number the reading list and the finish screen
 * show, so "what will this passage teach me?" has an answer before you open it.
 *
 * The saved list is cached briefly: the reading list and the reader both want
 * it, and it changes only when the reader stars a word — which calls
 * `forgetSavedWords()` on the way through.
 */
import { getDictionarySaves } from '../api/dictionary';

const TTL_MS = 60_000;

let cache: { at: number; words: Set<string> } | null = null;

const norm = (w: string) => w.trim().toLowerCase();

/** Drop the cache — call after starring/un-starring a word. */
export function forgetSavedWords(): void {
  cache = null;
}

/** The words the learner has ⭐ saved, lowercased. Never throws. */
export async function loadSavedWords(token: string | null): Promise<Set<string>> {
  if (!token) return new Set();
  if (cache && Date.now() - cache.at < TTL_MS) return cache.words;
  try {
    const rows = await getDictionarySaves(token);
    cache = { at: Date.now(), words: new Set(rows.map((r) => norm(r.word))) };
    return cache.words;
  } catch {
    // A stat is never worth an error state — fall back to what we last knew.
    return cache?.words ?? new Set();
  }
}

/** How many of a passage's key words the learner has not collected yet. */
export function newWordCount(
  keyVocab: { word: string }[] | undefined,
  saved: Set<string>,
): number {
  if (!keyVocab?.length) return 0;
  return keyVocab.filter((v) => v.word?.trim() && !saved.has(norm(v.word))).length;
}
