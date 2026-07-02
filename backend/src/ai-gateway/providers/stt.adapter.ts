import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
}

/** DI token for the active STT adapter. */
export const STT_ADAPTER = 'STT_ADAPTER';

const SCRIBE_MODEL = 'scribe_v1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** ElevenLabs Scribe implementation of {@link SttAdapter}. */
@Injectable()
export class ElevenLabsSttAdapter implements SttAdapter {
  private readonly logger = new Logger(ElevenLabsSttAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async transcribe(audio: Buffer, mime: string): Promise<SttResult> {
    const apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('ELEVENLABS_API_KEY тохируулаагүй байна');
    }

    // Retry once on 5xx (mirrors the Gemini retry style in words.service.ts).
    let lastStatus = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      const form = new FormData();
      form.append('model_id', SCRIBE_MODEL);
      form.append(
        'file',
        new Blob([new Uint8Array(audio)], { type: mime || 'audio/mp4' }),
        'audio',
      );

      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': apiKey },
        body: form,
      });

      if (response.ok) {
        const data = (await response.json()) as {
          text?: string;
          language_probability?: number;
          words?: { end?: number }[];
        };
        const words = data.words ?? [];
        const seconds = words.length ? Math.ceil(words[words.length - 1].end ?? 0) : 0;
        return {
          text: (data.text ?? '').trim(),
          confidence: data.language_probability ?? 1,
          seconds,
        };
      }

      lastStatus = response.status;
      if (response.status < 500) break; // client error → don't retry
      await sleep(1000);
    }

    this.logger.error(`ElevenLabs STT failed (${lastStatus})`);
    throw new InternalServerErrorException('Дуу хоолойг таньж чадсангүй');
  }
}
