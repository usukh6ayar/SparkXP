import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SttAdapter, SttResult, sttErrorMessage } from './stt.adapter';

/** Inline audio must stay under Gemini's request limit (~20MB); we guard a touch below. */
const MAX_INLINE_BYTES = 18 * 1024 * 1024;
/** Rough speaking rate — Gemini gives no timestamps, so bill by word count. */
const WORDS_PER_SECOND = 2.5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TRANSCRIBE_PROMPT =
  'Transcribe the speech in this audio verbatim. Return ONLY the spoken words as ' +
  'plain text — no timestamps, no speaker labels, no commentary, no quotation marks.';

/**
 * Gemini speech-to-text (multimodal). Sends the audio inline to
 * `gemini-2.5-flash:generateContent` with a "transcribe" instruction and reads
 * back the plain transcript — the Google speech-to-text the buddy + speaking exercise use.
 *
 * Gemini returns no confidence or timing, so confidence is 1 (the app's
 * low-confidence retry never fires) and duration is estimated from the word
 * count for voice-minute billing.
 */
@Injectable()
export class GeminiSttAdapter implements SttAdapter {
  private readonly logger = new Logger(GeminiSttAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async transcribe(audio: Buffer, mime: string): Promise<SttResult> {
    if (audio.length > MAX_INLINE_BYTES) {
      throw new InternalServerErrorException(
        'Аудио хэт урт байна. Богино хэсгээр хэлээд үзнэ үү.',
      );
    }
    return this.run(
      {
        inline_data: {
          mime_type: mime || 'audio/mp4',
          data: audio.toString('base64'),
        },
      },
      `mime=${mime} bytes=${audio.length}`,
      'Бичлэгийг уншиж чадсангүй. Дахин, арай удаан бөгөөд тод хэлээд үзнэ үү.',
    );
  }

  /**
   * Transcribe media at a public URL. Gemini can't fetch it itself for inline
   * use, so we pull the bytes and send them inline (guarded by size). Large
   * lesson videos above the inline limit are rejected clearly.
   */
  async transcribeUrl(url: string): Promise<SttResult> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new InternalServerErrorException('Медиаг татаж чадсангүй');
    }
    const mime = res.headers.get('content-type') ?? 'audio/mp4';
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_INLINE_BYTES) {
      throw new InternalServerErrorException(
        'Медиа хэт том байна (Gemini inline хязгаар). Богино клип ашиглана уу.',
      );
    }
    return this.run(
      { inline_data: { mime_type: mime, data: bytes.toString('base64') } },
      'url',
      'Видеоны яриаг таньж чадсангүй',
    );
  }

  private async run(
    audioPart: { inline_data: { mime_type: string; data: string } },
    label: string,
    fallbackMessage: string,
  ): Promise<SttResult> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'GEMINI_API_KEY тохируулаагүй байна',
      );
    }
    const model = this.config.get<string>(
      'GEMINI_STT_MODEL',
      'gemini-2.5-flash',
    );
    const urlEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = JSON.stringify({
      contents: [{ parts: [audioPart, { text: TRANSCRIBE_PROMPT }] }],
      // No "thinking" — a transcript is verbatim, not a reasoning task.
      generationConfig: {
        temperature: 0,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    let lastStatus = 0;
    let lastBody = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(urlEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = (
          data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        ).trim();
        const words = text ? text.split(/\s+/).length : 0;
        return {
          text,
          confidence: 1,
          seconds: Math.ceil(words / WORDS_PER_SECOND),
        };
      }
      lastStatus = response.status;
      lastBody = await response.text().catch(() => '');
      if (response.status < 500) break;
      await sleep(1000);
    }

    this.logger.error(
      `Gemini STT (${label}) failed (${lastStatus}): ${lastBody.slice(0, 300)}`,
    );
    throw new InternalServerErrorException(
      sttErrorMessage(lastStatus, fallbackMessage),
    );
  }
}
