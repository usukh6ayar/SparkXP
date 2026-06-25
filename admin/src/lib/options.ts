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
