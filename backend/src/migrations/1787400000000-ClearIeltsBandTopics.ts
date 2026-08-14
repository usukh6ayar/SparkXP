import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Data cleanup: stop using `topic` as an IELTS "target band".
 *
 * IELTS content used to be authored with `topic = 'Band 6.5'`, which the app
 * then showed as the browsing category. That was backwards: a band is the
 * RESULT of an attempt — the server computes it from the correct-answer count
 * in `ieltsBand(correct, total)` — so letting an author pick one, and letting a
 * student browse by one, promised a score the test cannot give. `topic` is now
 * the subject area it is everywhere else in the app (Science & research, Housing
 * & accommodation…), and difficulty lives in `level` (CEFR) as it always did.
 *
 * These rows would otherwise keep showing "Band 6.5" headings on the practice
 * list forever, since the app groups by `topic`. Clearing them drops the row
 * into its CEFR level group instead (`topic || level` on mobile) until someone
 * edits it and picks a real subject.
 *
 * Narrow on purpose: only IELTS categories, and only values that look exactly
 * like a band label — a legitimately named topic is never touched.
 *
 * Pure data, no schema change → `down()` is a no-op (restoring a wrong label
 * has no value).
 */
export class ClearIeltsBandTopics1787400000000 implements MigrationInterface {
  name = 'ClearIeltsBandTopics1787400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      UPDATE "quizzes"
         SET "topic" = NULL
       WHERE "category" LIKE 'ielts\\_%'
         AND "topic" ~* '^band[[:space:]]+[0-9](\\.[05])?$'
    `);
  }

  public async down(): Promise<void> {
    // Intentionally empty — see the class doc comment.
  }
}
