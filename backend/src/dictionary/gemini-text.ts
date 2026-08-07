import { InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { geminiRetryDelayMs } from '../words/words.service';

const logger = new Logger('GeminiText');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface GeminiTextResult {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface GeminiTextOptions {
  /** Ask Gemini to reply with JSON (responseMimeType + optional schema). */
  json?: boolean;
  /** JSON schema for the reply — only used when `json` is true. */
  schema?: unknown;
  /** Sampling temperature. Defaults to 0.3 (the existing dictionary value). */
  temperature?: number;
  /**
   * Хариултын дээд урт. Орхивол API-ийн анхдагчаар (хязгааргүй) явна.
   * Загвар хэт урт чалчихаас сэргийлнэ.
   */
  maxOutputTokens?: number;
  /**
   * "Бодох" (thinking) төсөв токеноор. **`0` = бодохыг унтраана**
   * (`gemini-2.5-*`). Орхивол загварын анхдагч хэвээр.
   *
   * Яагаад хэрэгтэй вэ: 2.5-flash дээр thinking анхдагчаар асаалттай бөгөөд
   * бүтэцтэй (JSON) хариу шаардах үед бодлоо гаралт руугаа асгаж, JSON-ыг
   * эвдэж, хариуг 10+ дахин уртасгадаг.
   */
  thinkingBudget?: number;
}

/**
 * One Gemini text call, shared by every dictionary feature.
 *
 * Retries transient 429 / 503 / "high demand" 404 responses the same way the
 * words pipeline does. `label` only appears in logs.
 *
 * Lifted out of DictionaryService so the senses service can reuse it without a
 * copy — and so JSON mode lives in exactly one place.
 */
export async function runGeminiText(
  config: ConfigService,
  prompt: string,
  label: string,
  options: GeminiTextOptions = {},
): Promise<GeminiTextResult> {
  const apiKey = config.get<string>('GEMINI_API_KEY');
  if (!apiKey) {
    throw new InternalServerErrorException(
      'GEMINI_API_KEY тохируулаагүй байна',
    );
  }
  const model = config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  /** Dropped after a 400, which is how Gemini rejects a schema it dislikes. */
  let useSchema = Boolean(options.schema);
  const buildRequest = () => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.3,
        ...(options.maxOutputTokens
          ? { maxOutputTokens: options.maxOutputTokens }
          : {}),
        ...(options.thinkingBudget !== undefined
          ? { thinkingConfig: { thinkingBudget: options.thinkingBudget } }
          : {}),
        ...(options.json
          ? {
              responseMimeType: 'application/json',
              ...(useSchema ? { responseSchema: options.schema } : {}),
            }
          : {}),
      },
    }),
  });

  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, buildRequest());
    if (response.ok) {
      const data = (await response.json()) as {
        candidates?: {
          finishReason?: string;
          content?: { parts?: { text?: string; thought?: boolean }[] };
        }[];
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
        };
      };
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .filter((p) => !p.thought && p.text)
        .map((p) => p.text)
        .join('')
        .trim();
      if (!text) {
        throw new InternalServerErrorException('AI хоосон хариу буцаалаа');
      }
      // Урт хязгаарт мөргөвөл JSON дунджаасаа тасарна. Дараагийн алхам нь
      // "JSON биш" гэж ойлгомжгүй уначихаас өмнө шалтгааныг нь хэлье.
      if (data.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
        logger.error(
          `Gemini "${label}" hit maxOutputTokens — reply truncated at ${text.length} chars`,
        );
        throw new InternalServerErrorException(
          'AI хариу хэт урт болж таслагдлаа — асуултын тоог багасгаж дахин оролдоно уу',
        );
      }
      return {
        text,
        model,
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      };
    }

    const body = await response.text().catch(() => '');

    // A 400 with a schema attached is Gemini rejecting the schema itself, not
    // the prompt — retrying it unchanged would fail forever. Drop the schema
    // and ask once more in plain JSON mode: the callers' parsers already treat
    // the reply as untrusted and accept the unstructured shape, so a schema the
    // API stops liking degrades the answer instead of taking the feature down.
    if (response.status === 400 && useSchema) {
      logger.warn(
        `Gemini rejected the schema for "${label}" — retrying without it`,
      );
      useSchema = false;
      continue;
    }

    const transient =
      response.status === 429 ||
      response.status === 503 ||
      (response.status === 404 &&
        /high demand|unavailable|overloaded|try again/i.test(body));
    if (transient && attempt < MAX_ATTEMPTS) {
      const waitMs = geminiRetryDelayMs(body, attempt);
      logger.warn(
        `Gemini ${response.status} for "${label}" — retry ${attempt}/${MAX_ATTEMPTS - 1} in ${waitMs}ms`,
      );
      await sleep(waitMs);
      continue;
    }

    logger.error(`Gemini dictionary failed (${response.status}): ${body}`);
    throw new InternalServerErrorException('Орчуулга үүсгэхэд алдаа гарлаа');
  }
}
