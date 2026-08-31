import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  runGeminiText,
  streamGeminiText,
  toGeminiContents,
} from '../../common/gemini/gemini-text';
import { LlmAdapter, LlmMessage, LlmResult } from './llm.adapter';

/** Fast + cheap chat model. Override with GEMINI_LLM_MODEL. */
const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Хэрэглэгч хүлээж буй нэг turn дээр хийх нийт оролдлого.
 *
 * Дундын туслах анхдагчаар 5 удаа, 30 сек хүртэл хүлээж оролддог — background
 * import job-д зөв. AI Buddy-гийн зорилт нь 3 секундийн хариу тул тэр бодлого
 * энд хэдэн арван секундийн чимээгүй зогсолт болно. Хоёр оролдлого = нэг
 * түр зуурын 429/503-ыг давна, түүнээс цааш `completeTurn` өөрөө fallback-тай.
 */
const TURN_MAX_ATTEMPTS = 2;

/**
 * Google Gemini implementation of {@link LlmAdapter}.
 *
 * Бүх HTTP/retry/JSON-mode логик нь дундын `runGeminiText`-д байгаа тул энд
 * зөвхөн Gemini-гийн ярианы хэлбэрт тохируулах ажил үлдэнэ:
 *
 *  - `assistant` → `model` дүр, эхлэл/төгсгөлийн `user` нормалчлал
 *    (`toGeminiContents`);
 *  - `systemInstruction` — persona-г ярианы мессеж болгож хийхгүй;
 *  - **`thinkingBudget: 0`** — 2.5-flash дээр "бодох" нь анхдагчаар асаалттай
 *    бөгөөд бүтэцтэй JSON хариу дээр хэдэн секунд нэмдэг. Buddy turn нь
 *    латенси мэдрэмтгий тул үүнийг унтраана;
 *  - `responseMimeType: application/json` — buddy-гийн гэрээ JSON, харин
 *    `responseSchema` өгөхгүй: `parseBuddyTurn` хариуг найдваргүй гэж үзэн
 *    өөрөө шалгаж, нормалчилдаг.
 */
@Injectable()
export class GeminiLlmAdapter implements LlmAdapter {
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.model = config.get<string>('GEMINI_LLM_MODEL', DEFAULT_MODEL);
  }

  async complete(
    system: string,
    messages: LlmMessage[],
    maxTokens: number,
  ): Promise<LlmResult> {
    const result = await runGeminiText(this.config, '', 'buddy-turn', {
      model: this.model,
      system,
      contents: toGeminiContents(messages),
      json: true,
      // Тоглоомч биш, гэхдээ хэт хатуу ч биш — Anthropic/OpenAI замын
      // анхдагчтай ойролцоо ярианы төрх.
      temperature: 0.7,
      // OpenAI adapter-тэй ижил шалтгаанаар доод хязгаартай: buddy-гийн JSON
      // дугтуй (correction + монгол тайлбар) Gemini дээр муу токенчилогддог тул
      // 500 нь дунджаасаа тасарч, `runGeminiText` MAX_TOKENS дээр алдаа шиднэ →
      // хэрэглэгч "Sorry, I got stuck" сонсоно. Урт нь prompt + `parseBuddyTurn`
      // -ээр хянагддаг тул илүү толгойн зай өгөх нь үнэ нэмэхгүй.
      maxOutputTokens: Math.max(maxTokens, 1024),
      thinkingBudget: 0,
      maxAttempts: TURN_MAX_ATTEMPTS,
    });
    return {
      text: result.text,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      model: result.model,
    };
  }

  /** {@link LlmAdapter.completeStream} — ижил тохиргоо, урсгал хэлбэрээр. */
  async completeStream(
    system: string,
    messages: LlmMessage[],
    maxTokens: number,
    onDelta: (delta: string, fullSoFar: string) => void,
    signal?: AbortSignal,
  ): Promise<LlmResult> {
    const result = await streamGeminiText(
      this.config,
      {
        model: this.model,
        system,
        contents: toGeminiContents(messages),
        json: true,
        temperature: 0.7,
        maxOutputTokens: Math.max(maxTokens, 1024),
        thinkingBudget: 0,
      },
      onDelta,
      signal,
    );
    return {
      text: result.text,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      model: result.model,
    };
  }
}
