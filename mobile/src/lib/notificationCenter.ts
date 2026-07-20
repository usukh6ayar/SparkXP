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

// ── DEV-only preview data ───────────────────────────────────────────────────
// Lets us exercise the full notification flow (home bell dot → list → categories
// → swipe → CTA) before the admin panel has sent any real broadcasts. Gated
// behind __DEV__ so it never ships, and only used when the real list is empty.
// DELETE this block + its imports once real notifications exist.
const MIN = 60_000, HR = 60 * MIN, DAY = 24 * HR;
export const DEV_MOCK_NOTIFICATIONS: AppNotification[] = __DEV__
  ? [
      { id: 'mockv2-1', targetRole: null, title: '🔥 Өдрийн дараалал', body: '15 өдрийн дарааллаа таслуулалгүй үргэлжлүүл!', createdAt: new Date(Date.now() - 5 * MIN).toISOString() },
      { id: 'mockv2-2', targetRole: null, title: '🤖 AI Найз', body: 'Өнөөдрийн ярианы дасгал бэлэн боллоо.', createdAt: new Date(Date.now() - 2 * HR).toISOString() },
      { id: 'mockv2-3', targetRole: null, title: '🏆 Амжилт нээгдлээ', body: 'Vocabulary Master II тэмдэг авлаа.', createdAt: new Date(Date.now() - 6 * HR).toISOString() },
      { id: 'mockv2-4', targetRole: null, title: '⭐ XP шагнал', body: '+150 XP цуглууллаа.', createdAt: new Date(Date.now() - 1 * DAY - 2 * HR).toISOString() },
      { id: 'mockv2-5', targetRole: null, title: '👥 Найзын мэдээ', body: 'Батбаяр таны сонсголын оноог дайрч гарлаа.', createdAt: new Date(Date.now() - 1 * DAY - 5 * HR).toISOString() },
      { id: 'mockv2-6', targetRole: null, title: 'Шинэ хувилбар гарлаа', body: 'SparkXP 2.0 — олон шинэ хичээл нэмэгдлээ.', createdAt: new Date(Date.now() - 4 * DAY).toISOString() },
    ]
  : [];

/** Visual buckets a notification can fall into (drives icon + accent color). */
export type NotifCategory =
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
  { category: 'aibuddy', words: ['🤖', 'ai buddy', 'ai найз', 'buddy', 'speaking', 'ярих дасгал', 'ai чат'] },
  { category: 'achievement', words: ['🏆', 'achievement', 'unlock', 'badge', 'medal', 'master', 'амжилт', 'тэмдэг', 'нээгд'] },
  { category: 'friend', words: ['👥', 'friend', 'passed', 'follow', 'дагагч', 'чансаа', 'дайрч', 'найзын', 'ангийн'] },
  { category: 'rewards', words: ['⭐', '💎', 'xp', 'spark', 'очир', 'reward', 'шагнал', 'gem', 'points', 'оноо'] },
  { category: 'learning', words: ['🔥', 'streak', 'lesson', 'хичээл', 'дараалал', 'урам', 'review', 'давтлага', 'daily', 'өдрийн', 'сурал'] },
];

/** Classify a broadcast into a visual category from its title + body. */
export function categorize(n: AppNotification): NotifCategory {
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
  if (category === 'learning') return 'learning';
  if (category === 'aibuddy') return 'aibuddy';
  return 'system';
}

/** Day bucket for the section a notification is grouped under. */
export type TimeBucket = 'today' | 'yesterday' | 'earlier';

export function bucketOf(iso: string): TimeBucket {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const t = new Date(iso).getTime();
  if (t >= startOfToday.getTime()) return 'today';
  if (t >= startOfToday.getTime() - 86_400_000) return 'yesterday';
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
