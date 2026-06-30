import { apiRequest } from './client';

/** A key vocabulary item (Phase 2 adds AI guess-choices). */
export interface ReadingKeyVocab {
  word: string;
  correctMeaning?: string;
  choices?: string[];
  correctIndex?: number;
  reviewed?: boolean;
}

/** One sentence of a passage (Phase 3 adds audio + timings). */
export interface ReadingSentence {
  index: number;
  text: string;
  audioUrl: string | null;
  startMs?: number;
  endMs?: number;
}

export interface ReadingPassage {
  id: string;
  title: string;
  cefr: string;
  wordCount: number;
  estimatedReadingTime: number; // seconds
  coverImageUrl: string | null;
  keyVocab: ReadingKeyVocab[];
  sentences: ReadingSentence[];
  isPublished: boolean;
}

/** Reading passages authored in admin. Students get published ones only. */
export function getReadingList(
  token: string,
  params?: { cefr?: string },
): Promise<{ items: ReadingPassage[]; total: number }> {
  // Plain query string — React Native's URLSearchParams is unreliable.
  let url = '/reading?limit=50';
  if (params?.cefr) url += `&cefr=${params.cefr.toLowerCase()}`;
  return apiRequest(url, { token });
}

export function getReadingPassage(id: string, token: string): Promise<ReadingPassage> {
  return apiRequest(`/reading/${id}`, { token });
}

/** Mark a passage finished → awards XP once (idempotent on the server). */
export function completeReading(
  id: string,
  token: string,
): Promise<{ passageId: string; alreadyCompleted: boolean; xpAwarded: number }> {
  return apiRequest(`/reading/${id}/complete`, { method: 'POST', token });
}
