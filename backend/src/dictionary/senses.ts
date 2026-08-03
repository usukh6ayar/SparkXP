/**
 * The dictionary "search" result shape: the 4-sense format the product spec
 * asks for. Deliberately has NO title, label or definition — just the word (or
 * phrase), one English example and its Mongolian translation.
 */
export interface WordSense {
  /** The word or phrase this sense belongs to, e.g. "run", "run out of". */
  word: string;
  /** A short English example sentence. */
  example: string;
  /** Mongolian translation of `example`. */
  translation: string;
}

/** Never store or show more than this many senses for one word. */
export const MAX_SENSES = 4;

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

/** One field of a sense: a non-empty string after trimming. */
function cleanField(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
    return [];
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
    const word = cleanField(row.word);
    const example = cleanField(row.example);
    const translation = cleanField(row.translation);
    if (!word || !example || !translation) continue;
    senses.push({ word, example, translation });
    if (senses.length === MAX_SENSES) break;
  }
  return senses;
}
