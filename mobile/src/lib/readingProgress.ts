/**
 * "Where am I in each passage" tracking for the Reading section.
 *
 * Two sources, on purpose:
 *   • the SERVER (`GET /reading/progress`) owns the resume point and the
 *     completion date — that is what makes a passage you started on the phone
 *     continue on the tablet;
 *   • the LOCAL mirror (`completionStore`) only remembers what you finished, so
 *     the checkmarks and rings on the list still draw with no network.
 *
 * Nothing here awards XP — the server does that in `POST /reading/:id/complete`.
 */
import { makeCompletionStore } from './completionStore';
import { getReadingProgress } from '../api/reading';

const store = makeCompletionStore('reading.completed');

/** Ids of passages the user has finished reading (local mirror). */
export const loadCompletedReading = store.load;

/** Record a passage as finished (idempotent). */
export const markReadingCompleted = store.mark;

/** How far the reader got in one passage. */
export interface ReadingState {
  /** Last sentence reached. 0 = never opened, or opened on page one. */
  sentenceIndex: number;
  completed: boolean;
  /** Recency: 0 = touched most recently. Local-only rows sort last. */
  rank: number;
}

/**
 * Server progress merged over the local completion mirror, keyed by passage id.
 *
 * The merge order matters: local completion goes in first so an offline device
 * still shows its checkmarks, then the server rows overwrite the resume point.
 * A passage the server calls finished stays finished even if this device never
 * saw it — and a locally-finished one is never demoted by a server row that
 * only carries a bookmark.
 */
export async function loadReadingStates(
  token: string | null,
): Promise<Map<string, ReadingState>> {
  const states = new Map<string, ReadingState>();
  const local = await loadCompletedReading();
  for (const id of local) {
    states.set(id, { sentenceIndex: 0, completed: true, rank: Number.MAX_SAFE_INTEGER });
  }

  if (!token) return states;
  try {
    // The endpoint returns most-recently-touched first — that order is what
    // "Үргэлжлүүлэх" picks from, so it is kept as each row's rank.
    const rows = await getReadingProgress(token);
    rows.forEach((row, rank) => {
      states.set(row.passageId, {
        sentenceIndex: row.sentenceIndex ?? 0,
        completed: row.completedAt != null || (states.get(row.passageId)?.completed ?? false),
        rank,
      });
    });
  } catch {
    // Offline or a failed request → the local mirror is still a useful answer.
  }
  return states;
}

/** The finished ids inside a state map (what the list's rings/checks want). */
export function completedIdsFrom(states: Map<string, ReadingState>): Set<string> {
  const done = new Set<string>();
  states.forEach((s, id) => {
    if (s.completed) done.add(id);
  });
  return done;
}

/**
 * Reading share (0..1) of a passage, from its bookmark.
 *
 * `sentenceIndex` is the sentence the reader was ON, so a bookmark on the last
 * sentence of a 10-sentence passage is 10/10 read, not 9/10 — hence the +1.
 * Finished passages are 1 regardless: the test, not the scroll, ends a passage.
 */
export function readShare(state: ReadingState | undefined, sentenceCount: number): number {
  if (!state) return 0;
  if (state.completed) return 1;
  if (sentenceCount <= 0) return 0;
  return Math.min(1, (state.sentenceIndex + 1) / sentenceCount);
}
