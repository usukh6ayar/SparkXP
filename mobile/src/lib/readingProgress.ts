/**
 * Local "which passages have I finished" tracking for the Reading section.
 * Drives the progress rings + checkmarks on the reading list. See
 * `completionStore` for the storage mechanics.
 */
import { makeCompletionStore } from './completionStore';

const store = makeCompletionStore('reading.completed');

/** Ids of passages the user has finished reading. */
export const loadCompletedReading = store.load;

/** Record a passage as finished (idempotent). */
export const markReadingCompleted = store.mark;
