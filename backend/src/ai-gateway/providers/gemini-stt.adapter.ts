import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SttAdapter, SttResult, sttErrorMessage } from './stt.adapter';

/**
 * STT загвар.
 *
 * `gemini-2.5-flash`-аас **`gemini-3.5-flash-lite`** руу шилжсэн (2026-08-28).
 * Ижил аудио, ижил prompt дээр 20 дуудлагын хэмжилт:
 *
 * | загвар                 | p50    | p90    | p95    | WER  |
 * |------------------------|--------|--------|--------|------|
 * | gemini-2.5-flash       | 2811ms | 3203ms | 3446ms | 0.02 |
 * | **gemini-3.5-flash-lite** | **1694ms** | **2394ms** | **2517ms** | 0.02 |
 * | gemini-flash-lite-latest  | 2319ms | 3230ms | 3664ms | 0.02 |
 *
 * Нэрийг нь тогтоосон (`-latest` alias биш): alias нь чимээгүй шилждэг ба
 * хэмжилтэд p95 нь мэдэгдэхүйц муу байсан.
 */
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

/** Inline audio must stay under Gemini's request limit (~20MB); we guard a touch below. */
const MAX_INLINE_BYTES = 18 * 1024 * 1024;
/** Rough speaking rate — Gemini gives no timestamps, so bill by word count. */
const WORDS_PER_SECOND = 2.5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TRANSCRIBE_PROMPT =
  'Transcribe the speech in this audio verbatim. Return ONLY the spoken words as ' +
  'plain text — no timestamps, no speaker labels, no commentary, no quotation marks.';

/**
 * Яриагүй аудио дээр Gemini transcript буцаахын оронд **өөрийн prompt-оо
 * цуурайтуулдаг** (хэмжсэн 2026-08-29: чимээгүй бичлэг →
 * `"Transcribe the speech in this audio verbatim."`).
 *
 * Тэр текст цааш урсвал buddy LLM түүнийг хэрэглэгчийн үг гэж үзээд
 * *"I can't help with audio transcription…"* гэж татгалздаг. Улмаар
 * `messages.raw_text`-д хадгалагдаж, дараагийн turn бүрийн түүхэнд дахин
 * тоглогддог тул session бүхэлдээ хордоно.
 *
 * Тиймээс цуурайг "яриа олдсонгүй" гэж үзнэ. Дуудагч тал
 * (`BuddyService.audioTurn`) хоосон transcript дээр аль хэдийн зөв аашилдаг:
 * хэрэглэгчээс дахин хэлэхийг гуйж, LLM/TTS хүртэл огт очихгүй.
 */
export function isTranscribePromptEcho(text: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const t = norm(text);
  // Дор хаяж 4 үг шаардана — богино жинхэнэ хариултыг санамсаргүй таслахгүйн тулд.
  if (t.split(' ').filter(Boolean).length < 4) return false;
  return norm(TRANSCRIBE_PROMPT).startsWith(t);
}

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
    const model = this.config.get<string>('GEMINI_STT_MODEL', DEFAULT_MODEL);
    const urlEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    /**
     * `thinkingConfig`-ийг зөвхөн 2.5 цуврал хүлээж авдаг; шинэ flash-lite
     * загварууд хүсэлтийг бүхэлд нь **400**-аар татгалздаг. Тэдгээр нь
     * анхдагчаараа "бодохгүй" тул алдагдах зүйл алга.
     */
    let sendThinking = model.startsWith('gemini-2.5');
    const buildBody = () =>
      JSON.stringify({
        contents: [{ parts: [audioPart, { text: TRANSCRIBE_PROMPT }] }],
        generationConfig: {
          temperature: 0,
          // No "thinking" — a transcript is verbatim, not a reasoning task.
          ...(sendThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      });

    let lastStatus = 0;
    let lastBody = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(urlEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buildBody(),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = (
          data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        ).trim();
        // Prompt-ийн цуурай = яриа олдсонгүй. `confidence: 0` буцаавал
        // дуудагчийн доод итгэлийн шалгуур ажиллана (доор `confidence` нь
        // үргэлж 1 тул өөр ямар ч хамгаалалт энэ кейсийг барихгүй).
        if (isTranscribePromptEcho(text)) {
          this.logger.warn(
            `Gemini STT (${label}): prompt echo — яриагүй бичлэг гэж үзэв`,
          );
          return { text: '', confidence: 0, seconds: 0 };
        }
        const words = text ? text.split(/\s+/).length : 0;
        return {
          text,
          confidence: 1,
          seconds: Math.ceil(words / WORDS_PER_SECOND),
        };
      }
      lastStatus = response.status;
      lastBody = await response.text().catch(() => '');
      // Загварын нэр өөрчлөгдөж `thinkingConfig`-ийг татгалзвал дуу хоолой
      // БҮХЭЛДЭЭ унана. Нэг удаа түүнгүйгээр дахин оролдоно — дээрх угтварын
      // шалгуур нь хэзээ нэгэн цагт хоцрох нь тодорхой.
      if (response.status === 400 && sendThinking) {
        this.logger.warn(
          `Gemini STT: "${model}" rejected thinkingConfig — retrying without it`,
        );
        sendThinking = false;
        continue;
      }
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
