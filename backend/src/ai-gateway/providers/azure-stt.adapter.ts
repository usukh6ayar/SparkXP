import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SttAdapter, SttResult, sttErrorMessage } from './stt.adapter';

/**
 * Azure **Fast Transcription** speech-to-text.
 *
 * Chosen over the two other Azure paths for concrete reasons, both measured:
 *  - the **Speech SDK** (WebSocket) fails with `ConnectionFailure 1006` on
 *    Node 26 here, while every REST endpoint on the same key works;
 *  - the **REST short-audio** endpoint accepts only WAV — handed the m4a the
 *    app actually records it answers `RecognitionStatus: Success` with an
 *    **empty transcript**, a silent failure. Fast Transcription reads m4a
 *    directly, so nothing changes on the device.
 *
 * Measured against the audio the Gemini adapter was benchmarked on
 * (30 requests, paced under the rate limit): p50 **281ms**, p95 428ms,
 * WER 0.02 — roughly 1.2s faster than Gemini at identical accuracy.
 *
 * ⚠️ **Rate limited to 20 requests/minute** on the current Speech resource
 * (measured exactly: request 21 returns 429 `Resource Exhausted`, and the
 * window clears after ~60s). That is ~5–6 students speaking at once, so this
 * adapter is **not** the default: it is selected with `STT_PROVIDER=azure`,
 * and only after the quota is raised. See `FallbackSttAdapter` for what
 * happens when the limit is hit anyway.
 */
@Injectable()
export class AzureFastSttAdapter implements SttAdapter {
  private readonly logger = new Logger(AzureFastSttAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async transcribe(audio: Buffer, mime: string): Promise<SttResult> {
    return this.run(audio, mime || 'audio/mp4');
  }

  /** Lesson media at a URL: fetch, then transcribe the bytes. */
  async transcribeUrl(url: string): Promise<SttResult> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new InternalServerErrorException('Медиаг татаж чадсангүй');
    }
    const mime = res.headers.get('content-type') ?? 'audio/mp4';
    return this.run(Buffer.from(await res.arrayBuffer()), mime);
  }

  private async run(audio: Buffer, mime: string): Promise<SttResult> {
    const key = this.config.get<string>('AZURE_SPEECH_KEY');
    const region = this.config.get<string>('AZURE_SPEECH_REGION');
    if (!key || !region) {
      throw new InternalServerErrorException(
        'AZURE_SPEECH_KEY / AZURE_SPEECH_REGION тохируулаагүй байна',
      );
    }
    const locale = this.config.get<string>('AZURE_STT_LOCALE', 'en-US');

    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(audio)], { type: mime }), 'turn');
    form.append(
      'definition',
      new Blob([JSON.stringify({ locales: [locale] })], {
        type: 'application/json',
      }),
    );

    const response = await fetch(
      `https://${region}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15`,
      { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key }, body: form },
    );
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(
        `Azure STT failed (${response.status}): ${body.slice(0, 200)}`,
      );
      throw new SttProviderError(
        response.status,
        sttErrorMessage(
          response.status,
          'Бичлэгийг уншиж чадсангүй. Дахин, арай удаан бөгөөд тод хэлээд үзнэ үү.',
        ),
      );
    }

    const data = (await response.json()) as {
      durationMilliseconds?: number;
      combinedPhrases?: { text?: string }[];
    };
    const text = (data.combinedPhrases?.[0]?.text ?? '').trim();
    return {
      text,
      // Fast Transcription reports no confidence on the combined phrase, and
      // the caller's low-confidence branch only exists to ask the student to
      // repeat — which an empty transcript already triggers.
      confidence: 1,
      seconds: Math.ceil((data.durationMilliseconds ?? 0) / 1000),
    };
  }
}

/**
 * An STT failure that carries the provider's HTTP status, so a wrapper can tell
 * "this provider is throttled/broken" (worth retrying elsewhere) apart from
 * "this audio is unusable" (retrying elsewhere would waste a second provider).
 */
export class SttProviderError extends InternalServerErrorException {
  /** Provider HTTP status. Named `providerStatus` because Nest's exception
   *  base already owns a private `status`. */
  readonly providerStatus: number;

  constructor(providerStatus: number, message: string) {
    super(message);
    this.providerStatus = providerStatus;
  }
}
