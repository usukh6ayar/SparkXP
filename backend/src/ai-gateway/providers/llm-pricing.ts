/**
 * LLM өртгийн тооцоо (`ai_usages.cost_micro_usd`).
 *
 * Нэгж: **1 сая токен тутмын ам.доллар** (жагсаалтын үнэ). Тогтмолуудыг шууд
 * микро-доллар/токен болгон ашиглаж болох нь тохиолдол биш —
 * `tokens × (USD/1e6) × 1e6 = tokens × USD_per_million` тул хөрвүүлэг хэрэггүй.
 *
 * ⚠️ Өмнө нь энэ тооцоо `promptTokens * 0.0008 + completionTokens * 0.004` гэж
 * bud.service дотор бичигдсэн байсан — энэ нь сая токеныг $0.0008 гэсэн үг
 * буюу бодит үнээс ~1000 дахин бага. `ai_usages`-д хуримтлагдсан ХУУЧИН
 * мөрүүд тэр алдаатай хэвээр; шинэ мөрүүд л зөв болно.
 *
 * Провайдер үнээ өөрчилдөг — эдгээр нь мөнгө шууд гаргадаггүй, зөвхөн тайлан
 * тул ойролцоо байхад хангалттай. Загвар нэмэхдээ угтварыг нь энд нэм.
 */
interface Rate {
  /** USD per 1M input tokens. */
  in: number;
  /** USD per 1M output tokens. */
  out: number;
}

/**
 * Загварын нэрийн **угтвараар** тааруулна (нэрс нь `-20251001` мэтийн огноотой
 * байдаг). Эхэлж тохирсон нь хожино тул илүү тодорхойг нь дээр нь тавь.
 */
const RATES: [prefix: string, rate: Rate][] = [
  ['gemini-2.5-flash-lite', { in: 0.1, out: 0.4 }],
  ['gemini-2.5-flash', { in: 0.3, out: 2.5 }],
  ['gemini-2.5-pro', { in: 1.25, out: 10 }],
  ['gpt-4o-mini', { in: 0.15, out: 0.6 }],
  ['gpt-4o', { in: 2.5, out: 10 }],
  ['claude-haiku-4-5', { in: 1, out: 5 }],
  ['claude-sonnet', { in: 3, out: 15 }],
];

/**
 * Танихгүй загварт хэрэглэх ханш. Тэг биш байх нь чухал: үнэгүй мэт харагдах
 * загвар нь хязгаарын сэрэмжлүүлгийг чимээгүй болгоно.
 */
const FALLBACK: Rate = { in: 1, out: 5 };

/** Нэг LLM дуудлагын өртөг микро-доллараар. */
export function llmCostMicroUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const rate =
    RATES.find(([prefix]) => model.startsWith(prefix))?.[1] ?? FALLBACK;
  return Math.round(promptTokens * rate.in + completionTokens * rate.out);
}
