/**
 * IELTS shared constants + band scoring.
 *
 * Content model (Approach A): IELTS content is a normal Quiz tagged with one of
 * these categories. Objective modules (listening/reading) are auto-scored into
 * an approximate band; writing/speaking are self-study (no score).
 */
export const IELTS_CATEGORIES = {
  listening: 'ielts_listening',
  reading: 'ielts_reading',
  writing: 'ielts_writing',
  speaking: 'ielts_speaking',
} as const;

/**
 * Most parts a single practice set can be split into.
 *
 * Listening is the widest real module (4 sections); Academic Reading has 3
 * passages. Questions carry a `section` number in the `questions` jsonb — see
 * `BaseQuestionDto`.
 */
export const MAX_SECTIONS = 4;

/** Categories whose submissions get an auto band (objective answers). */
export const IELTS_OBJECTIVE_CATEGORIES: readonly string[] = [
  IELTS_CATEGORIES.listening,
  IELTS_CATEGORIES.reading,
];

/**
 * Approximate IELTS band (0–9, half-steps) for an objective module from the raw
 * score. Official band tables assume a 40-question test; practice sets are
 * smaller, so we map by percentage (correct/total) to the nearest half-band
 * using anchor thresholds derived from the Academic conversion midpoints.
 */
export function ieltsBand(correct: number, total: number): number {
  if (total <= 0) return 0;
  const pct = correct / total;
  // [minPercentage, band] — highest threshold that pct meets wins.
  const anchors: [number, number][] = [
    [0.975, 9.0],
    [0.9, 8.5],
    [0.825, 8.0],
    [0.75, 7.5],
    [0.65, 7.0],
    [0.575, 6.5],
    [0.5, 6.0],
    [0.4, 5.5],
    [0.325, 5.0],
    [0.25, 4.5],
    [0.15, 4.0],
    [0.1, 3.5],
    [0.05, 3.0],
    [0.0, 2.5],
  ];
  for (const [threshold, band] of anchors) {
    if (pct >= threshold) return band;
  }
  return 0;
}

/**
 * ⚠️ Энд өмнө нь `IELTS_BAND_TOPICS`, `parseBandTopic()`, `bandToLevel()`
 * байсныг 2026-08-14-нд УСТГАВ.
 *
 * Тэдгээр нь контент үүсгэхэд «зорилтот band»-ыг `topic` талбарт хадгалж,
 * сурагчид түүгээр нь ангилж харуулдаг байв. Band бол **дүн**: доорх
 * `ieltsBand(correct, total)` нь зөв хариултын тооноос гаргадаг, тэр л цорын
 * ганц эх сурвалж. Зорилтот band-ыг урьдчилж сонгуулах нь «Band 6.5 гэсэн
 * бүлгээс сонговол 6.5 авна» гэсэн худал ойлголт төрүүлдэг.
 *
 * Хүндрэл = `Quiz.level` (CEFR), сэдэв = `Quiz.topic` (жинхэнэ агуулгын салбар).
 */
