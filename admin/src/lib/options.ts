// Shared option lists used across admin pages (kept here so CEFR levels aren't
// re-declared in every page that has a level <select>).

/** CEFR proficiency levels, low → high. */
export const CEFR_LEVELS: string[] = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

/** Level <select> options for forms (A1…C2). */
export const levelFormOptions = CEFR_LEVELS.map((v) => ({ value: v, label: v.toUpperCase() }));

/** Level <select> options for filters (adds an "all levels" entry). */
export const levelFilterOptions = [
  { value: '', label: 'Бүх түвшин' },
  ...levelFormOptions,
];

/**
 * Reading-passage topics (сэдэв). Free text on the backend — the stored value
 * IS the label, so admin + mobile show the same string. Keep in sync with the
 * backend `READING_CATEGORY_SUGGESTIONS` and the mobile list.
 */
export const READING_CATEGORIES: string[] = [
  'Өдөр тутам',
  'Шинжлэх ухаан',
  'Технологи',
  'Түүх',
  'Байгаль',
  'Спорт',
  'Соёл',
  'Аялал',
  'Бизнес',
  'Эрүүл мэнд',
];

/** Topic <select> options for the reading form (incl. an empty "no topic"). */
export const readingCategoryOptions = [
  { value: '', label: 'Сэдэвгүй' },
  ...READING_CATEGORIES.map((v) => ({ value: v, label: v })),
];

/**
 * Exercise sub-categories (сэдэв) per skill. Free text on the backend — the
 * stored value IS the label, so admin + mobile show the same string (mobile
 * groups a skill's exercises by it). Keep in sync with the mobile skill screen.
 */
export const EXERCISE_CATEGORIES: Record<string, string[]> = {
  listening: [
    'Өдөр тутмын яриа',
    'Дуудлага сонсох',
    'Дуу & дууны үг',
    'Кино клип',
    'Подкаст',
    'Мэдээ',
    'Аялал',
    'Сорил',
  ],
  writing: [
    'Өгүүлбэр зохиох',
    'Догол мөр',
    'Эссэ',
    'И-мэйл',
    'Өгүүллэг',
    'Дүрэм засах',
    'Сорил',
  ],
  speaking: [
    'Дуудлага',
    'Дагаж хэлэх',
    'Ярианы дадлага',
    'Дүрд тоглох',
    'Өөрийгөө танилцуулах',
    'Ярилцлага',
    'Аялал',
    'Сорил',
  ],
  fill: [
    'Цаг (tense)',
    'Угтвар үг',
    'Артикль',
    'Үйл үгийн хэлбэр',
    'Үг сонгох',
    'Сорил',
  ],
  grammar: [
    'Цаг (tense)',
    'Тооны ялгаа',
    'Угтвар үг',
    'Артикль',
    'Асуух өгүүлбэр',
    'Үгүйсгэл',
    'Сорил',
  ],
  // Reading uses ReadingPassage (its own сэдэв), but keep it here for symmetry.
  reading: [...READING_CATEGORIES],
};

/** Сэдэв <select> options for one skill's exercise form (incl. empty option). */
export function exerciseCategoryOptions(skill: string) {
  return [
    { value: '', label: 'Сэдэвгүй' },
    ...(EXERCISE_CATEGORIES[skill] ?? []).map((v) => ({ value: v, label: v })),
  ];
}

/**
 * IELTS modules → Quiz `category` value. Objective modules (listening/reading)
 * are auto-scored to a band; writing/speaking are self-study (open_response).
 */
export const IELTS_MODULES = [
  { key: 'listening', label: 'Listening', category: 'ielts_listening', objective: true },
  { key: 'reading', label: 'Reading', category: 'ielts_reading', objective: true },
  { key: 'writing', label: 'Writing', category: 'ielts_writing', objective: false },
  { key: 'speaking', label: 'Speaking', category: 'ielts_speaking', objective: false },
] as const;

/** Free-text сэдэв suggestions per IELTS module (stored value = label). */
const IELTS_SUBTOPICS: Record<string, string[]> = {
  listening: ['Section 1', 'Section 2', 'Section 3', 'Section 4', 'Сорил'],
  reading: ['Academic', 'General Training', 'True/False/NG', 'Matching headings', 'Сорил'],
  writing: ['Task 1 (Academic)', 'Task 1 (General)', 'Task 2 (Essay)'],
  speaking: ['Part 1', 'Part 2 (Cue card)', 'Part 3'],
};

/** Сэдэв <select> options for one IELTS module's form (incl. empty option). */
export function ieltsSubTopicOptions(moduleKey: string) {
  return [
    { value: '', label: 'Сэдэвгүй' },
    ...(IELTS_SUBTOPICS[moduleKey] ?? []).map((v) => ({ value: v, label: v })),
  ];
}
