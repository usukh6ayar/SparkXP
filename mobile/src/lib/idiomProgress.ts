/**
 * Local "which idioms have I learned" tracking. Idioms have no backend
 * completion endpoint, so opening an idiom's detail counts as learning it; the
 * list then shows a progress ring + checkmarks. See `completionStore`.
 */
import { makeCompletionStore } from './completionStore';

const store = makeCompletionStore('idioms.learned');

/** Ids of idioms the user has opened/learned. */
export const loadLearnedIdioms = store.load;

/** Record an idiom as learned (idempotent). */
export const markIdiomLearned = store.mark;
