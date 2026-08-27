import { t, tf } from '../i18n';

/**
 * Compact "x ago" label from an ISO timestamp; falls back to a date past a week.
 *
 * Shared by the notification centre and the assignments list — both answer the
 * same question ("did this arrive today?"), and a student who cannot tell
 * today's homework from last week's stops trusting the list.
 */
export function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return t('timeNow');
  if (min < 60) return tf('timeMinAgo', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return tf('timeHourAgo', { n: hr });
  const day = Math.floor(hr / 24);
  if (day < 7) return tf('timeDayAgo', { n: day });
  return new Date(iso).toLocaleDateString();
}

/** Arrived within the last 24h — "today's homework" for badge purposes. */
export function isRecent(iso: string, hours = 24): boolean {
  return Date.now() - new Date(iso).getTime() < hours * 3_600_000;
}
