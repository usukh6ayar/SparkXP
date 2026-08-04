// The sense shape itself lives in common/ so the DictionaryEntry entity can
// type its jsonb column without an entity → feature import. Re-exported here
// so feature code keeps a single import site.
export type { WordSense } from '../common/types/word-sense';

import type { WordSense } from '../common/types/word-sense';

/** Never store or show more than this many senses for one word. */
export const MAX_SENSES = 4;

/**
 * Per-field length bounds. The AI-sourced path (parseSenses) and the
 * admin-edited path (SenseDto in dto/update-senses.dto.ts, built in a later
 * task) enforce the same numbers from this one constant.
 */
export const SENSE_FIELD_MAX = {
  word: 120,
  example: 300,
  translation: 300,
} as const;

// Note: we deliberately never dedupe senses. Dedup would have to compare the
// FULL { word, example, translation } triple, never `word` alone — the same
// headword is allowed to appear in several senses (e.g. "run" twice with
// different examples).

/** Gemini's JSON schema for a senses request (generationConfig.responseSchema). */
export const SENSES_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      word: { type: 'STRING' },
      example: { type: 'STRING' },
      translation: { type: 'STRING' },
    },
    required: ['word', 'example', 'translation'],
  },
};

/** Prompt asking for the most-common senses of `word`, frequency-ordered. */
export function sensesPrompt(word: string): string {
  return (
    `"${word}" гэсэн англи үгийн бодит амьдрал дээр хамгийн түгээмэл ` +
    'хэрэглэгддэг утгуудыг хэрэглээний давтамжаар (хамгийн түгээмэлээс нь) ' +
    `эрэмбэлж, хамгийн ихдээ ${MAX_SENSES} ширхэгийг JSON массиваар буцаа.\n` +
    'Утга тус бүрд:\n' +
    '- "word": тухайн утгад тохирох үг эсвэл холбоо үг (ж: "run", "run out of")\n' +
    '- "example": богино англи жишээ өгүүлбэр\n' +
    '- "translation": тэр өгүүлбэрийн монгол орчуулга\n' +
    'Тайлбар, тодорхойлолт, шошго, дугаарлалт бүү нэм. ' +
    `Ховор утгыг оруулахгүй — ${MAX_SENSES}-аас цөөн байж болно.`
  );
}

/**
 * One field of a sense: a non-empty string, trimmed, within `maxLength`.
 * Too long is dropped outright (return null) rather than truncated — a
 * truncated example sentence cached forever is worse than a missing one.
 */
function cleanField(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

/**
 * Turn Gemini's raw reply into at most MAX_SENSES trusted senses.
 *
 * Anything we can't fully verify is dropped instead of stored: the cache row is
 * written once and served forever, so a half-parsed sense would be permanent.
 * Returns [] when nothing survives — the caller then reports "not found" and
 * writes NOTHING to the cache.
 */
export function parseSenses(raw: string): WordSense[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  if (!cleaned) return [];

  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    // Defense-in-depth: Gemini is called in JSON mode with a responseSchema,
    // so this should rarely trigger. But if prose sneaks in around a fenced
    // block, retry once against just the fenced content before giving up.
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (!fenced) return [];
    try {
      data = JSON.parse(fenced.trim());
    } catch {
      return [];
    }
  }

  // Accept both a bare array and a { senses: [...] } wrapper.
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { senses?: unknown })?.senses)
      ? (data as { senses: unknown[] }).senses
      : [];

  const senses: WordSense[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const word = cleanField(row.word, SENSE_FIELD_MAX.word);
    const example = cleanField(row.example, SENSE_FIELD_MAX.example);
    const translation = cleanField(
      row.translation,
      SENSE_FIELD_MAX.translation,
    );
    if (!word || !example || !translation) continue;
    senses.push({ word, example, translation });
    if (senses.length === MAX_SENSES) break;
  }
  return senses;
}
