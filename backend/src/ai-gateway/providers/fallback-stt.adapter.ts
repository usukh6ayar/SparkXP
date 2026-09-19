import { Injectable, Logger } from '@nestjs/common';
import { SttAdapter, SttResult } from './stt.adapter';
import { SttProviderError } from './azure-stt.adapter';

/**
 * Хоёр STT провайдерыг дараалуулж, эхнийх нь **бүтэлгүйтсэн үед л** хоёр дахийг
 * дуудна.
 *
 * Дараалсан, зэрэгцээ БИШ гэдэг нь зориуд: амжилттай turn нь эхний провайдерын
 * хариуг шууд буцаадаг тул fallback байгаа нь ердийн хурдад **нэг ч
 * миллисекунд** нэмэхгүй. (Хоёуланг зэрэг дуудаж хожсоныг нь авах арга нь
 * латенсийг тэгшитгэх боловч turn бүрийн STT зардлыг хоёр дахин нэмэгдүүлнэ.)
 *
 * Хоёр дахь провайдерыг **зөвхөн провайдерын гэм** дээр дуудна: 429 (хязгаар),
 * 5xx, сүлжээний тасалдал. Аудио өөрөө уншигдахгүй (4xx) бол хоёр дахь нь ч
 * мөн уншиж чадахгүй — тэнд дахин оролдох нь хэрэглэгчийн хүлээлтийг хоёр
 * дахин уртасгаад л өнгөрнө.
 *
 * **Тасалгуур (circuit breaker).** Ганц удаа унасны дараа эхний провайдерыг
 * хэсэг хугацаанд огт дуудахгүй. Үүнгүйгээр rate limit нь хамгийн муу хэлбэрээ
 * авдаг: хязгаар дүүрсэн үед turn бүр Azure руу очиж 429 авч, дараа нь Gemini
 * рүү явна — өөрөөр хэлбэл **цэвэр Gemini-ээс УДААН** болно. Azure-ийн
 * `retry-after` (хэмжсэн: 54 сек) яг хэдийг хүлээхийг хэлдэг тул түүнийг дагана.
 */
@Injectable()
export class FallbackSttAdapter implements SttAdapter {
  private readonly logger = new Logger('FallbackStt');

  /** Epoch ms until which the primary is skipped outright. 0 = closed. */
  private skipPrimaryUntil = 0;

  constructor(
    private readonly primary: SttAdapter,
    private readonly secondary: SttAdapter,
    private readonly primaryName = 'primary',
  ) {}

  transcribe(audio: Buffer, mime: string): Promise<SttResult> {
    return this.attempt(
      () => this.primary.transcribe(audio, mime),
      () => this.secondary.transcribe(audio, mime),
    );
  }

  transcribeUrl(url: string): Promise<SttResult> {
    return this.attempt(
      () => this.primary.transcribeUrl(url),
      () => this.secondary.transcribeUrl(url),
    );
  }

  private async attempt(
    primary: () => Promise<SttResult>,
    secondary: () => Promise<SttResult>,
  ): Promise<SttResult> {
    // Breaker open: go straight to the secondary. This is the whole point —
    // a throttled provider must cost the student nothing, not a round trip.
    if (Date.now() < this.skipPrimaryUntil) return secondary();
    try {
      const result = await primary();
      this.skipPrimaryUntil = 0; // healthy again
      return result;
    } catch (err) {
      if (!shouldFallOver(err)) throw err;
      const cooldown = cooldownMs(err);
      this.skipPrimaryUntil = Date.now() + cooldown;
      this.logger.warn(
        `${this.primaryName} STT unavailable (${describe(err)}) — ` +
          `falling back and pausing it for ${Math.round(cooldown / 1000)}s`,
      );
      return secondary();
    }
  }
}

/**
 * Хэр удаан хүлээх вэ. Провайдер өөрөө хэлсэн бол түүнийг дагана; хэлээгүй
 * (5xx, сүлжээ) бол богинохон анхдагч — түр зуурын гэмтлээс болж хурдан
 * провайдераа шаардлагагүй удаан хаяхгүйн тулд.
 */
function cooldownMs(err: unknown): number {
  if (err instanceof SttProviderError && err.retryAfterMs) {
    return err.retryAfterMs;
  }
  return DEFAULT_COOLDOWN_MS;
}

const DEFAULT_COOLDOWN_MS = 30_000;

/** Провайдер өөрөө боломжгүй байна уу (тийм бол нөгөөг оролдоно). */
function shouldFallOver(err: unknown): boolean {
  if (err instanceof SttProviderError) {
    return err.providerStatus === 429 || err.providerStatus >= 500;
  }
  // Статусгүй алдаа = сүлжээ/timeout/задлалт — өөр провайдер дээр амжилттай
  // болох бүрэн боломжтой.
  return true;
}

function describe(err: unknown): string {
  if (err instanceof SttProviderError) return `HTTP ${err.providerStatus}`;
  return err instanceof Error ? err.message : String(err);
}
