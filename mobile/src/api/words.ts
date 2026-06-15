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

/** GET /api/words — vocabulary bank (used to introduce new words to study). */
export function getWords(
  token: string,
  params: { limit?: number } = {},
): Promise<Paginated<Word>> {
  const query = params.limit ? `?limit=${params.limit}` : '';
  return apiRequest<Paginated<Word>>(`/words${query}`, { token });
}
