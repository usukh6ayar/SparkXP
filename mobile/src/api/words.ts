import { apiRequest } from './client';

export interface Word {
  id: string;
  english: string;
  mongolian: string;
  exampleSentence: string | null;
  level: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/** One pre-signup taste-task question (C4). The correct answer is included on
 *  purpose: the app grades it locally, with no account and no server scoring. */
export interface SampleQuestion {
  english: string;
  answer: string;
  options: string[];
}

/** GET /api/words/sample — public taste-task questions (no token needed). */
export function getSampleQuestions(count = 3): Promise<SampleQuestion[]> {
  return apiRequest<SampleQuestion[]>(`/words/sample?count=${count}`);
}

/** GET /api/words — vocabulary bank (used to introduce new words to study). */
export function getWords(
  token: string,
  params: { limit?: number } = {},
): Promise<Paginated<Word>> {
  const query = params.limit ? `?limit=${params.limit}` : '';
  return apiRequest<Paginated<Word>>(`/words${query}`, { token });
}
