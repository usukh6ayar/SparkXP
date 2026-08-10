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

/** Idioms authored in admin. Students get published ones only. Paginated so the
 *  list can scroll past 100 (the app grew to hundreds of idioms). */
export function getIdiomList(
  token: string,
  params?: { search?: string; page?: number; limit?: number },
): Promise<{ items: Idiom[]; total: number; page: number; limit: number }> {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 50;
  let url = `/idioms?page=${page}&limit=${limit}`;
  if (params?.search) url += `&search=${encodeURIComponent(params.search)}`;
  return apiRequest(url, { token });
}

export function getIdiom(id: string, token: string): Promise<Idiom> {
  return apiRequest(`/idioms/${id}`, { token });
}
