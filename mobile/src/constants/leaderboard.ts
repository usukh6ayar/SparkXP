import type { Period } from '../api/leaderboard';
import { colors } from '../theme/theme';

export const PERIODS: { key: Period; label: string }[] = [
  { key: 'weekly', label: 'Долоо хоног' },
  { key: 'monthly', label: 'Сар' },
  { key: 'all_time', label: 'Бүх цаг' },
];

/** gold, silver, bronze — index 0 = rank 1. */
export const MEDAL = [colors.sparks, '#A9B4C7', '#CD7F4D'];
