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
    throw new InternalServerErrorException('GEMINI_API_KEY тохируулаагүй байна');
  }
  const model = config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const requestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.3,
        ...(options.json
          ? {
              responseMimeType: 'application/json',
              ...(options.schema ? { responseSchema: options.schema } : {}),
            }
          : {}),
      },
    }),
  };

  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, requestInit);
    if (response.ok) {
      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
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
      return {
        text,
        model,
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      };
    }

    const body = await response.text().catch(() => '');
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
