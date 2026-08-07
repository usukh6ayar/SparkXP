import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Data backfill: give the admin "Сорил" page's quizzes a `category`.
 *
 * The mobile app fetches standalone quizzes ONLY by category
 * (`GET /quizzes?standalone=true&isPublished=true&category=…`), but the admin
 * Сорил form never sent one — so every quiz authored there sat in the DB with
 * `category = NULL` and no screen could ever load it. The form now writes
 * `'soril'`; this hands the same value to the rows created before that fix,
 * otherwise publishing them still shows nothing.
 *
 * The predicate is safe because every OTHER authoring path always sets one of
 * the two columns: Дасгал writes `category` (create + CSV import), IELTS writes
 * `ielts_*`, and a lesson test always has a `lesson_id`. So
 * "standalone AND uncategorised" can only be a Сорил row.
 *
 * Pure data, no schema change → `down()` is a no-op (reverting would re-hide
 * the very content this exists to surface).
 */
export class BackfillSorilQuizCategory1787100000000
  implements MigrationInterface
{
  name = 'BackfillSorilQuizCategory1787100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      UPDATE "quizzes"
         SET "category" = 'soril'
       WHERE "category" IS NULL
         AND "lesson_id" IS NULL
    `);
  }

  public async down(): Promise<void> {
    // Intentionally empty — see the class doc comment.
  }
}
