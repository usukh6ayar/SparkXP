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
 */
@Injectable()
export class FallbackSttAdapter implements SttAdapter {
  private readonly logger = new Logger('FallbackStt');

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
    try {
      return await primary();
    } catch (err) {
      if (!shouldFallOver(err)) throw err;
      this.logger.warn(
        `${this.primaryName} STT unavailable (${describe(err)}) — falling back`,
      );
      return secondary();
    }
  }
}

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
