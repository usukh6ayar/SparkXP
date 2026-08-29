import { InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const logger = new Logger('GeminiText');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * How long to wait before retrying a Gemini call. Gemini's 429 body often
 * carries a RetryInfo ("retryDelay":"6s" / "Please retry in 6.2s"); honour it,
 * otherwise fall back to exponential backoff (2s, 4s, 8s…) capped at 30s.
 */
export function geminiRetryDelayMs(body: string, attempt: number): number {
  const m = body.match(/retry(?:Delay)?["\s:]+["']?(\d+(?:\.\d+)?)s/i);
  const suggested = m ? Math.ceil(parseFloat(m[1]) * 1000) : 0;
  const backoff = Math.min(2000 * 2 ** (attempt - 1), 30000);
  return Math.max(suggested, backoff);
}

export interface GeminiTextResult {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

/** One turn in a Gemini `contents` array. `model` is Gemini's word for "assistant". */
export interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
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
  /**
   * Загварын нэрийг дарж бичих. Орхивол `GEMINI_MODEL`.
   *
   * Яагаад хэрэгтэй вэ: толь бичиг/үгсийн санд чанар, AI Buddy-д хурд хэрэгтэй.
   * Нэг env-д уяхад нэгнийх нь тохиргоо нөгөөгийнхөө latency-г тодорхойлно.
   */
  model?: string;
  /**
   * Системийн заавар (`systemInstruction`). Persona/дүрмийг яриа болгон
   * `contents` дотор хийхээс илүү найдвартай.
   */
  system?: string;
  /**
   * Олон ээлжийн яриа. Өгвөл `prompt`-ыг үл тоомсорлоно.
   * Дуудагч нь эхлэл/төгсгөлийн `user` дүрмийг хангасан байх ёстой —
   * {@link toGeminiContents} үүнийг хийж өгнө.
   */
  contents?: GeminiContent[];
  /**
   * Түр зуурын алдаанд хийх нийт оролдлого. Анхдагч 5.
   *
   * Латенси мэдрэмтгий дуудагч (AI Buddy turn) үүнийг заавал багасгана:
   * 5 оролдлого × 30 сек хүртэлх backoff нь background job-д зөв, харин
   * хэрэглэгч хүлээж буй turn дээр хэдэн арван секунд зогсолт болно.
   */
  maxAttempts?: number;
}

/**
 * Chat-style мессежүүдийг Gemini-ийн `contents` болгоно.
 *
 * Gemini-д `assistant` гэсэн role байхгүй — `model` гэдэг. Түүнээс гадна
 * `contents` нь `user`-аар эхэлж, `user`-аар төгсөх ёстой; аль аль нь
 * дуудагчийн талд амархан зөрчигддөг (түүхийг сүүлийн N мессежээр таслахад
 * assistant-аар эхэлж болно; JSON-ыг засуулах retry нь assistant-аар төгсдөг).
 * Тиймээс нормалчлалыг энд нэг л газар хийнэ.
 */
export function toGeminiContents(
  messages: { role: 'user' | 'assistant'; content: string }[],
): GeminiContent[] {
  const contents: GeminiContent[] = messages
    .filter((m) => m.content?.trim())
    .map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }],
    }));

  // Эхний ээлж `model` байвал контекстгүй "хариулт"-аар яриа эхлэх тул хая.
  while (contents.length && contents[0].role === 'model') contents.shift();

  // Сүүлийн ээлж `model` байвал загварт хариулах юм алга. Түүнийг ярианы
  // нэг хэсэг болгож үлдээгээд, хамгийн сүүлд хоосон биш `user` ээлж хэрэгтэй.
  const last = contents[contents.length - 1];
  if (last && last.role === 'model') {
    contents.push({ role: 'user', parts: [{ text: 'Continue.' }] });
  }
  return contents;
}

/**
 * One Gemini text call, shared by every feature that needs one.
 *
 * Retries transient 429 / 503 / "high demand" 404 responses the same way the
 * words pipeline does. `label` only appears in logs.
 *
 * Lives in `common/` rather than next to a feature because the AI Buddy LLM
 * adapter needs it too, and `dictionary/` → `words.service` → `ai-gateway`
 * would have made that import circular.
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
  const model =
    options.model || config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  /** Dropped after a 400, which is how Gemini rejects a schema it dislikes. */
  let useSchema = Boolean(options.schema);
  const contents = options.contents ?? [
    { role: 'user' as const, parts: [{ text: prompt }] },
  ];
  const buildRequest = () => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      ...(options.system
        ? { systemInstruction: { parts: [{ text: options.system }] } }
        : {}),
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

  const MAX_ATTEMPTS = options.maxAttempts ?? 5;
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

    logger.error(`Gemini "${label}" failed (${response.status}): ${body}`);
    throw new InternalServerErrorException('Орчуулга үүсгэхэд алдаа гарлаа');
  }
}

/**
 * Gemini-гийн **урсгал** дуудлага (`streamGenerateContent`).
 *
 * `runGeminiText`-ээс тусдаа байгаа шалтгаан: энэ нь retry ХИЙХГҮЙ. Урсгалыг
 * дахин эхлүүлэх нь аль хэдийн ярьж эхэлсэн текстийг давхардуулах эрсдэлтэй,
 * мөн латенси мэдрэмтгий turn дээр дахин оролдох цаг байхгүй. Дуудагч нь
 * унасан үед урсгалгүй зам руу шилжинэ.
 *
 * `alt=sse` нь хариуг `data: {...}` мөрүүдээр өгнө — үүнгүйгээр Gemini бүтэн
 * JSON массив буцаадаг бөгөөд түүнийг хэсэгчлэн уншиж болохгүй.
 *
 * @param onDelta шинэ текст ирэх бүрд дуудагдана (хуримтлагдсан биш, зөвхөн шинэ хэсэг).
 * @returns бүрэн текст + токены тоо.
 */
export async function streamGeminiText(
  config: ConfigService,
  options: GeminiTextOptions & { contents: GeminiContent[] },
  onDelta: (delta: string, fullSoFar: string) => void,
  signal?: AbortSignal,
): Promise<GeminiTextResult> {
  const apiKey = config.get<string>('GEMINI_API_KEY');
  if (!apiKey) {
    throw new InternalServerErrorException('GEMINI_API_KEY тохируулаагүй байна');
  }
  const model =
    options.model || config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}` +
    `:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: options.contents,
      ...(options.system
        ? { systemInstruction: { parts: [{ text: options.system }] } }
        : {}),
      generationConfig: {
        temperature: options.temperature ?? 0.3,
        ...(options.maxOutputTokens
          ? { maxOutputTokens: options.maxOutputTokens }
          : {}),
        ...(options.thinkingBudget !== undefined
          ? { thinkingConfig: { thinkingBudget: options.thinkingBudget } }
          : {}),
        ...(options.json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });
  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => '');
    throw new InternalServerErrorException(
      `Gemini stream ${response.status}: ${body.slice(0, 200)}`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let full = '';
  let promptTokens = 0;
  let completionTokens = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    let nl: number;
    // SSE нь мөрөөр ирдэг ба нэг TCP багц дунд мөр дээр тасарч болно —
    // бүтэн мөр цугласан үед л задална.
    while ((nl = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, nl).trim();
      pending = pending.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      let packet: {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      try {
        packet = JSON.parse(line.slice(5));
      } catch {
        continue; // бүрэн бус багц — дараагийнх нь гүйцээнэ
      }
      if (packet.usageMetadata) {
        promptTokens = packet.usageMetadata.promptTokenCount ?? promptTokens;
        completionTokens =
          packet.usageMetadata.candidatesTokenCount ?? completionTokens;
      }
      const delta = (packet.candidates?.[0]?.content?.parts ?? [])
        .filter((p) => !p.thought && p.text)
        .map((p) => p.text)
        .join('');
      if (delta) {
        full += delta;
        onDelta(delta, full);
      }
    }
  }

  if (!full.trim()) {
    throw new InternalServerErrorException('AI хоосон хариу буцаалаа');
  }
  return { text: full, model, promptTokens, completionTokens };
}
