import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lesson Stars (Task 2) — add `best_score` (best test %) and `completed_at`
 * (first pass) to `user_lesson_stars`. Backward compatible: existing rows keep
 * their stars; `best_score` defaults to 0 and `completed_at` stays null until
 * the next result recomputes them.
 *
 * Dev (DB_SYNCHRONIZE=true) gets the columns from the entity; prod runs this.
 */
export class AddLessonStarBestScore1786900000000 implements MigrationInterface {
  name = 'AddLessonStarBestScore1786900000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "user_lesson_stars" ADD COLUMN IF NOT EXISTS "best_score" integer NOT NULL DEFAULT 0`,
    );
    await q.query(
      `ALTER TABLE "user_lesson_stars" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "user_lesson_stars" DROP COLUMN IF EXISTS "completed_at"`);
    await q.query(`ALTER TABLE "user_lesson_stars" DROP COLUMN IF EXISTS "best_score"`);
  }
}
