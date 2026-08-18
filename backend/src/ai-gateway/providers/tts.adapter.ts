/** Result of a text-to-speech call: raw audio bytes + how long they play. */
export interface TtsResult {
  audio: Buffer;
  durationMs: number;
  model: string;
  voiceId: string;
}

/**
 * Text → speech. The single seam for swapping TTS providers. Returns raw audio;
 * storage stays with the caller (ImageStorage).
 */
export interface TtsAdapter {
  synthesize(
    text: string,
    voiceId?: string,
    params?: Record<string, unknown>,
  ): Promise<TtsResult>;
}

/** DI token for the active TTS adapter. */
export const TTS_ADAPTER = 'TTS_ADAPTER';
