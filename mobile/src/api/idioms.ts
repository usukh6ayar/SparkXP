import { apiRequest } from './client';

export interface Idiom {
  id: string;
  phrase: string;
  mongolian: string;
  meaning: string | null;
  definition: string | null;
  exampleSentence: string | null;
  exampleTranslation: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  isPublished: boolean;
}

/** Idioms authored in admin. Students get published ones only. */
export function getIdiomList(
  token: string,
  params?: { search?: string },
): Promise<{ items: Idiom[]; total: number }> {
  let url = '/idioms?limit=100';
  if (params?.search) url += `&search=${encodeURIComponent(params.search)}`;
  return apiRequest(url, { token });
}

export function getIdiom(id: string, token: string): Promise<Idiom> {
  return apiRequest(`/idioms/${id}`, { token });
}
