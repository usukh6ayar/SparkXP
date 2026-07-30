import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * "How many exercises have I finished TODAY" — the counter behind the Soril
 * screen's daily path.
 *
 * Local on purpose (for now): the backend has no per-day exercise counter, only
 * lifetime `quizzesDone` and today's XP. Counting locally means the path works
 * immediately; when Өсөхбаяр ships the endpoint requested in
 * `docs/REQUEST_choi_daily_path.md` this file becomes the fallback, not the
 * source of truth.
 *
 * The stored date is the reset: a new day silently starts at 0, so there is no
 * cron and nothing to clean up.
 */
const KEY = 'dailyTasks.v1';

/** How many exercises make a full day. Also the number of nodes drawn. */
export const DAILY_TASK_GOAL = 5;

interface Stored {
  /** Local calendar day, `YYYY-MM-DD`. */
  d: string;
  /** Exercises finished on that day. */
  n: number;
  /** True once the completion bonus has been handed out for that day. */
  claimed?: boolean;
}

/** Local (not UTC) day key — the student's midnight is the one that matters. */
function today(): string {
  const now = new Date();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

async function read(): Promise<Stored> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Stored) : null;
    if (parsed && parsed.d === today()) return parsed;
  } catch {
    // fall through to a fresh day
  }
  return { d: today(), n: 0 };
}

/** Exercises finished today (0 on a new day). */
export async function loadDailyTasks(): Promise<{ done: number; claimed: boolean }> {
  const s = await read();
  return { done: s.n, claimed: !!s.claimed };
}

/**
 * Count one finished exercise. Returns the new state so the caller can react
 * (e.g. celebrate the moment the goal is met).
 */
export async function markDailyTask(): Promise<{ done: number; claimed: boolean }> {
  const s = await read();
  const next: Stored = { d: s.d, n: s.n + 1, claimed: s.claimed };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort — a lost tick is not worth breaking a quiz over
  }
  return { done: next.n, claimed: !!next.claimed };
}

/** Mark today's bonus as handed out, so it cannot be claimed twice. */
export async function markDailyBonusClaimed(): Promise<void> {
  const s = await read();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...s, claimed: true }));
  } catch {
    // best-effort
  }
}
