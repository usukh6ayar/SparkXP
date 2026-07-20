/**
 * Local "which exercises have I passed" tracking for the skill screens
 * (Listening / Speaking / Writing / Fill …). Quiz ids are globally unique, so a
 * single set covers every skill; each screen filters to the items it shows.
 * Drives the progress rings + checkmarks. See `completionStore` for mechanics.
 */
import { makeCompletionStore } from './completionStore';

const store = makeCompletionStore('exercises.completed');

/** Ids of exercises (quizzes) the user has passed. */
export const loadCompletedExercises = store.load;

/** Record an exercise as passed (idempotent). */
export const markExerciseCompleted = store.mark;
