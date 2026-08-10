import { apiUpload } from './client';

/** Result of a pronunciation check (POST /api/speaking/check). */
export interface SpeakCheckResult {
  /** True when what STT heard matches the target word closely enough. */
  correct: boolean;
  /** What the recogniser heard — shown back so the learner can compare. */
  transcript: string;
  /** 0–1 closeness of transcript vs target. */
  similarity: number;
}

/**
 * Upload a recording of `target` and get whether it was pronounced right.
 * The word rides in the query string because `apiUpload` only sends the file.
 */
export function checkPronunciation(
  fileUri: string,
  target: string,
  token: string,
): Promise<SpeakCheckResult> {
  return apiUpload<SpeakCheckResult>(
    `/speaking/check?target=${encodeURIComponent(target)}`,
    { uri: fileUri, name: 'speak.m4a', type: 'audio/m4a' },
    token,
  );
}
