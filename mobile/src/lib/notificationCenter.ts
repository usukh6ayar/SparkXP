/**
 * Client-side "Activity Center" logic for the notifications screen.
 *
 * The backend broadcast API only gives us `title`/`body`/`createdAt` (see
 * `api/notifications.ts`) — no category, per-item read flag, or CTA. So we
 * derive the category from the text here, and keep read / dismissed / muted
 * state locally in AsyncStorage. This is purely a presentation layer: it never
 * touches the backend, API, or the global theme.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppNotification } from '../api/notifications';
import type { TranslationKey } from '../i18n';

/** Visual buckets a notification can fall into (drives icon + accent color). */
export type NotifCategory =
  | 'assignment'
  | 'learning'
  | 'rewards'
  | 'achievement'
  | 'aibuddy'
  | 'friend'
  | 'system';

/**
 * Keyword → category rules, checked in priority order (first match wins).
 * Covers Mongolian, English and the emoji admins tend to prefix. Anything we
 * can't classify stays `system` (a neutral gray announcement) — honest rather
 * than mislabelled.
 */
const RULES: { category: NotifCategory; words: string[] }[] = [
  { category: 'assignment', words: ['даалгавар', 'assignment', 'homework'] },
  { category: 'aibuddy', words: ['🤖', 'ai buddy', 'ai найз', 'buddy', 'speaking', 'ярих дасгал', 'ai чат'] },
  { category: 'achievement', words: ['🏆', 'achievement', 'unlock', 'badge', 'medal', 'master', 'амжилт', 'тэмдэг', 'нээгд'] },
  { category: 'friend', words: ['👥', 'friend', 'passed', 'follow', 'дагагч', 'чансаа', 'дайрч', 'найзын', 'ангийн'] },
  { category: 'rewards', words: ['⭐', '💎', 'xp', 'spark', 'очир', 'reward', 'шагнал', 'gem', 'points', 'оноо'] },
  { category: 'learning', words: ['🔥', 'streak', 'lesson', 'хичээл', 'дараалал', 'урам', 'review', 'давтлага', 'daily', 'өдрийн', 'сурал'] },
];

/** `data.type` values the backend sets, mapped to their visual category. */
const TYPE_CATEGORY: Record<string, NotifCategory> = {
  assignment: 'assignment',
  review_due: 'learning',
};

/**
 * Classify a notification into a visual category.
 *
 * Prefers the backend's own `data.type` — it is authoritative, so a teacher
 * note that happens to contain the word "оноо" is not mislabelled as a reward.
 * Falls back to keyword matching for admin broadcasts and older rows, which
 * carry no `data` at all.
 */
export function categorize(n: AppNotification): NotifCategory {
  const byType = n.data?.type ? TYPE_CATEGORY[n.data.type] : undefined;
  if (byType) return byType;

  const text = `${n.title} ${n.body}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.words.some((w) => text.includes(w))) return rule.category;
  }
  return 'system';
}

/** Which filter chip a category belongs under (achievement rolls into Rewards). */
export type ChipKey = 'all' | 'learning' | 'rewards' | 'aibuddy' | 'social' | 'system';

export function chipOf(category: NotifCategory): Exclude<ChipKey, 'all'> {
  if (category === 'achievement' || category === 'rewards') return 'rewards';
  if (category === 'friend') return 'social';
  // Homework files under Learning rather than earning a 7th chip — it is
  // learning work, and the row already reads "Шинэ даалгавар".
  if (category === 'learning' || category === 'assignment') return 'learning';
  if (category === 'aibuddy') return 'aibuddy';
  return 'system';
}

/** Day bucket for the section a row is grouped under. */
export type TimeBucket = 'today' | 'yesterday' | 'week' | 'earlier';

/** The order sections are rendered in — newest bucket first. */
export const BUCKET_ORDER: TimeBucket[] = ['today', 'yesterday', 'week', 'earlier'];

/**
 * Section labels, kept next to the buckets so every list that groups by day
 * (notification centre, assignments) reads the same words.
 */
export const BUCKET_LABEL: Record<TimeBucket, TranslationKey> = {
  today: 'notifGroupToday',
  yesterday: 'notifGroupYesterday',
  week: 'notifGroupWeek',
  earlier: 'notifGroupEarlier',
};

export function bucketOf(iso: string): TimeBucket {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const t = new Date(iso).getTime();
  if (t >= startOfToday.getTime()) return 'today';
  if (t >= startOfToday.getTime() - 86_400_000) return 'yesterday';
  // "Earlier" alone lumped last Tuesday in with last month. A week is the
  // window a student still thinks of as "recent", so it gets its own section.
  if (t >= startOfToday.getTime() - 7 * 86_400_000) return 'week';
  return 'earlier';
}

// ── Local read / dismissed / muted state ────────────────────────────────────

const READ_KEY = 'notifications.read';
const DISMISSED_KEY = 'notifications.dismissed';
const MUTED_KEY = 'notifications.muted';

async function loadSet(key: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

async function saveSet(key: string, set: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // best-effort; a lost read flag is non-critical
  }
}

export const notifStore = {
  loadRead: () => loadSet(READ_KEY),
  saveRead: (s: Set<string>) => saveSet(READ_KEY, s),
  loadDismissed: () => loadSet(DISMISSED_KEY),
  saveDismissed: (s: Set<string>) => saveSet(DISMISSED_KEY, s),
  loadMuted: () => loadSet(MUTED_KEY),
  saveMuted: (s: Set<string>) => saveSet(MUTED_KEY, s),
};
