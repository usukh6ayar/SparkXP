/** Result of a speech-to-text call. */
export interface SttResult {
  /** Raw transcript — NEVER grammar-cleaned (it is the input for corrections). */
  text: string;
  /** 0–1 confidence; low values trigger the "I didn't catch that" fallback. */
  confidence: number;
  /** Length of the transcribed audio in seconds (for voice-minute billing). */
  seconds: number;
}

/** Audio → text. The single seam for swapping STT providers. */
export interface SttAdapter {
  transcribe(audio: Buffer, mime: string): Promise<SttResult>;
  /**
   * Same thing, but from a public URL. Used for lesson videos so a large upload
   * needn't be forwarded through a caller that already has the URL.
   */
  transcribeUrl(url: string): Promise<SttResult>;
}

/** DI token for the active STT adapter. */
export const STT_ADAPTER = 'STT_ADAPTER';

/**
 * Turn an HTTP status into something the student can act on.
 *
 * Saying "couldn't hear you" for every failure implies the learner spoke wrong —
 * but most failures (bad key, quota) have nothing to do with the mic. The caller
 * knows its context ("voice" vs "video speech") and passes the fallback.
 */
export function sttErrorMessage(
  status: number,
  fallback = 'Дуу хоолойг таньж чадсангүй. Дахин оролдоно уу.',
): string {
  if (status === 401 || status === 403) {
    return 'Дуу таних үйлчилгээний тохиргоо буруу байна. Админд мэдэгдэнэ үү.';
  }
  if (status === 429) {
    return 'Дуу таних үйлчилгээний хязгаар дүүрсэн байна. Түр хүлээгээд дахин оролдоно уу.';
  }
  if (status >= 500) {
    return 'Дуу таних үйлчилгээ түр ажиллахгүй байна. Хэсэг хүлээгээд дахин оролдоно уу.';
  }
  return fallback;
}
