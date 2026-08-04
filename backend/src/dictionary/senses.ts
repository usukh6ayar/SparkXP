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

/**
 * Max length of the WORD's own Mongolian meaning — the one line shown under the
 * headword in the Толь panel, e.g. "гүйх; ажиллуулах; урсах".
 *
 * ⚠️ Not to be confused with `SENSE_FIELD_MAX.translation`, which bounds a
 * sense's EXAMPLE SENTENCE translation. Two different fields, both named
 * `translation` — see DictionaryEntry.
 */
export const WORD_TRANSLATION_MAX = 200;

// Note: we deliberately never dedupe senses. Dedup would have to compare the
// FULL { word, example, translation } triple, never `word` alone — the same
// headword is allowed to appear in several senses (e.g. "run" twice with
// different examples).

/**
 * Gemini's JSON schema for a dictionary request (generationConfig.responseSchema).
 *
 * An object, not a bare array: one call returns BOTH the word's own meaning and
 * its senses, so showing the meaning costs no extra AI request.
 */
export const SENSES_SCHEMA = {
  type: 'OBJECT',
  properties: {
    translation: { type: 'STRING' },
    senses: {
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
    },
  },
  required: ['translation', 'senses'],
};

/** Prompt asking for the word's own meaning + its most-common senses. */
export function sensesPrompt(word: string): string {
  return (
    `"${word}" гэсэн англи үгийн бодит амьдрал дээр хамгийн түгээмэл ` +
    'хэрэглэгддэг утгуудыг хэрэглээний давтамжаар (хамгийн түгээмэлээс нь) ' +
    'эрэмбэлж JSON объектоор буцаа.\n' +
    '- "translation": УГ ҮГИЙН өөрийнх нь монгол утга. Хамгийн түгээмэл 1–3 ' +
    'утгыг "; "-ээр тусгаарлана (ж: "гүйх; ажиллуулах; урсах"). Өгүүлбэр биш, ' +
    'зөвхөн утга.\n' +
    `- "senses": хамгийн ихдээ ${MAX_SENSES} утга. Тус бүрд:\n` +
    '  - "word": тухайн утгад тохирох үг эсвэл холбоо үг (ж: "run", "run out of")\n' +
    '  - "example": богино англи жишээ өгүүлбэр\n' +
    '  - "translation": тэр өгүүлбэрийн монгол орчуулга\n' +
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

/** What one parsed dictionary reply yields. */
export interface ParsedEntry {
  /** The word's own Mongolian meaning, or null when it can't be trusted. */
  translation: string | null;
  /** At most MAX_SENSES verified senses; [] when nothing survives. */
  senses: WordSense[];
}

/**
 * Turn Gemini's raw reply into a trusted entry: the word's meaning + at most
 * MAX_SENSES senses.
 *
 * Anything we can't fully verify is dropped instead of stored: the cache row is
 * written once and served forever, so a half-parsed sense would be permanent.
 * `senses: []` tells the caller to report "not found" and write NOTHING; a null
 * `translation` is survivable on its own (the panel just omits that line), so it
 * never invalidates otherwise good senses.
 *
 * Shapes accepted, in order: `{ translation, senses: [...] }` (current),
 * `{ senses: [...] }` and a bare array (both pre-2026-08-05, still cached in
 * prompts/replies) — the older two simply have no translation.
 */
export function parseEntry(raw: string): ParsedEntry {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  const empty: ParsedEntry = { translation: null, senses: [] };
  if (!cleaned) return empty;

  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    // Defense-in-depth: Gemini is called in JSON mode with a responseSchema,
    // so this should rarely trigger. But if prose sneaks in around a fenced
    // block, retry once against just the fenced content before giving up.
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (!fenced) return empty;
    try {
      data = JSON.parse(fenced.trim());
    } catch {
      return empty;
    }
  }

  // Accept both a bare array and a { translation?, senses: [...] } wrapper.
  const wrapper = (Array.isArray(data) ? null : data) as {
    translation?: unknown;
    senses?: unknown;
  } | null;
  const list = Array.isArray(data)
    ? data
    : Array.isArray(wrapper?.senses)
      ? (wrapper.senses as unknown[])
      : [];
  // Named apart from the per-sense `translation` below — they are different
  // fields, and shadowing inside the loop would hide that.
  const wordTranslation = cleanField(
    wrapper?.translation,
    WORD_TRANSLATION_MAX,
  );

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
  return { translation: wordTranslation, senses };
}

/**
 * Senses only — kept for callers (and tests) that don't need the word meaning.
 * One parser, one set of rules: this is a projection of `parseEntry`, never a
 * second implementation.
 */
export function parseSenses(raw: string): WordSense[] {
  return parseEntry(raw).senses;
}
