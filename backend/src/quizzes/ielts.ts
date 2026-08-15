import { ContentLevel } from '../common/enums';

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
 * IELTS контентыг **зорилтот band**-аар нь ангилна.
 *
 * Яагаад `topic` талбарт вэ: апп IELTS модулиудыг `topic`-оор нь бүлэглэдэг
 * (`mobile/app/skill/[key].tsx` → `CategoryBrowser`). Band-ыг тэнд хадгалснаар
 * аппын код өөрчлөхгүйгээр «Band 6.0» гэсэн бүлгүүд гарч ирнэ. Шинэ багана
 * нэмэх шаардлагагүй тул migration ч хэрэггүй.
 *
 * Хүрээ нь 4.5–8.0: үүнээс доош бол IELTS бэлтгэл эхлэх түвшин биш, дээш нь
 * бэлтгэлийн материалаар сурах хэсэг биш болно.
 */
export const IELTS_BAND_TOPICS = [
  'Band 4.5',
  'Band 5.0',
  'Band 5.5',
  'Band 6.0',
  'Band 6.5',
  'Band 7.0',
  'Band 7.5',
  'Band 8.0',
] as const;

/** `"Band 6.5"` → `6.5`. Band биш сэдэв бол `null` (хуучин контент). */
export function parseBandTopic(topic?: string | null): number | null {
  const m = /^band\s+([0-9](?:\.[05])?)$/i.exec((topic ?? '').trim());
  if (!m) return null;
  const band = Number(m[1]);
  return Number.isFinite(band) ? band : null;
}

/**
 * Зорилтот band → CEFR түвшин.
 *
 * `Quiz.level` нь CEFR enum тул band-ыг тэнд хадгалж болохгүй. Админ band-аа
 * л сонгоод, түвшинг нь эндээс автоматаар гаргана — «хоёр талбар бөглөх»
 * шаардлагагүй болно.
 * Харьцуулалт нь IELTS-ийн нийтэлсэн CEFR-тэй дүйцүүлэх хүснэгтээс.
 */
export function bandToLevel(band: number): ContentLevel {
  if (band >= 7.5) return ContentLevel.C1;
  if (band >= 5.5) return ContentLevel.B2;
  return ContentLevel.B1;
}
