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
    let lastBody = '';
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
      // Шалтгааныг УНШИНА. Урьд нь зөвхөн статусыг логддог байсан тул
      // «Дуу хоолойг таньж чадсангүй» гэсэн мессежийн ард эрхийн асуудал
      // байна уу, эрх зүйн хязгаар уу, формат буруу юу гэдгийг хэн ч мэдэх
      // аргагүй байв (Choi, 2026-08-16).
      lastBody = await response.text().catch(() => '');
      if (response.status < 500) break; // client error → don't retry
      await sleep(1000);
    }

    this.logger.error(
      `ElevenLabs STT failed (${lastStatus}) mime=${mime} bytes=${audio.length}: ` +
        lastBody.slice(0, 300),
    );
    throw new InternalServerErrorException(sttErrorMessage(lastStatus));
  }
}

/**
 * Статусыг **хийж болох зүйл** рүү хөрвүүлнэ.
 *
 * Бүх бүтэлгүйтэлд «Дуу хоолойг таньж чадсангүй» гэж хэлэх нь сурагчид «чи
 * буруу хэлсэн» гэсэн мэдрэмж төрүүлдэг — гэтэл ихэнхдээ микрофонтой ч,
 * дуудлагатай ч огт хамаагүй (түлхүүр буруу, эрх дууссан г.м.).
 */
export function sttErrorMessage(status: number): string {
  if (status === 401 || status === 403) {
    return 'Дуу таних үйлчилгээний тохиргоо буруу байна. Админд мэдэгдэнэ үү.';
  }
  if (status === 429) {
    return 'Дуу таних үйлчилгээний хязгаар дүүрсэн байна. Түр хүлээгээд дахин оролдоно уу.';
  }
  if (status === 422 || status === 400) {
    return 'Бичлэгийг уншиж чадсангүй. Дахин, арай удаан бөгөөд тод хэлээд үзнэ үү.';
  }
  if (status >= 500) {
    return 'Дуу таних үйлчилгээ түр ажиллахгүй байна. Хэсэг хүлээгээд дахин оролдоно уу.';
  }
  return 'Дуу хоолойг таньж чадсангүй. Дахин оролдоно уу.';
}
