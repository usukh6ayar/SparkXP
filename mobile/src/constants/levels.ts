import type { TranslationKey } from '../i18n';

/**
 * Placement / CEFR levels (a1..c1) with a display code + i18n label & hint.
 * Shared by registration and the edit-profile form. `value` is what the backend
 * stores (lowercase); `code` is what we show (e.g. "B1").
 */
export const CEFR_LEVELS: { value: string; code: string; labelKey: TranslationKey; descKey: TranslationKey }[] = [
  { value: 'a1', code: 'A1', labelKey: 'cefrA1', descKey: 'cefrA1Desc' },
  { value: 'a2', code: 'A2', labelKey: 'cefrA2', descKey: 'cefrA2Desc' },
  { value: 'b1', code: 'B1', labelKey: 'cefrB1', descKey: 'cefrB1Desc' },
  { value: 'b2', code: 'B2', labelKey: 'cefrB2', descKey: 'cefrB2Desc' },
  { value: 'c1', code: 'C1', labelKey: 'cefrC1', descKey: 'cefrC1Desc' },
];
