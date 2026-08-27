/**
 * One timed mouth shape: an Azure viseme id (0–21) and when it starts, in ms
 * from the beginning of the audio. Providers that can't report timing omit the
 * whole list and the app falls back to shapes guessed from the reply text.
 */
export interface VisemeCue {
  id: number;
  offsetMs: number;
}

/** Result of a text-to-speech call: raw audio bytes + how long they play. */
export interface TtsResult {
  audio: Buffer;
  durationMs: number;
  model: string;
  voiceId: string;
  /**
   * Content type of `audio` and the extension it should be stored under.
   *
   * Not cosmetic: these used to be hard-coded as mp3 at the call site while the
   * adapter actually returned WAV, so every cached clip was served under a
   * content type it wasn't. Adapters now state their own format.
   */
  mimeType: string;
  fileExtension: string;
  /** Lip-sync timeline, when the provider gives one (Azure HD Voice). */
  visemes?: VisemeCue[];
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
