import type { Period } from '../api/leaderboard';
import type { TranslationKey } from '../i18n';
import { colors } from '../theme/theme';

export const PERIODS: { key: Period; labelKey: TranslationKey }[] = [
  { key: 'weekly', labelKey: 'periodWeekly' },
  { key: 'monthly', labelKey: 'periodMonthly' },
  { key: 'all_time', labelKey: 'periodAllTime' },
];

/** gold, silver, bronze — index 0 = rank 1. */
export const MEDAL = [colors.sparks, '#A9B4C7', '#CD7F4D'];
