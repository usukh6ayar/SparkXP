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
