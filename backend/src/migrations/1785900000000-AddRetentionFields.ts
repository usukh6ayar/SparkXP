import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Retention groundwork: a per-user daily XP goal + push-notification delivery.
 *
 * `daily_goal_xp` replaces a hard-coded `DAILY_GOAL = 50` constant, so the
 * Home XP ring can show a target the learner actually chose.
 *
 * The push columns are what made reminders impossible before: the app had no
 * way to tell the server where to deliver, so `NotificationsService` could
 * only `console.log`. `last_reminder_at` guards against double-sending if the
 * cron ever runs twice.
 */
export class AddRetentionFields1785900000000 implements MigrationInterface {
  name = 'AddRetentionFields1785900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "daily_goal_xp" integer NOT NULL DEFAULT 50`,
    );
    await q.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "expo_push_token" character varying`,
    );
    await q.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "push_enabled" boolean NOT NULL DEFAULT true`,
    );
    await q.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_reminder_at" TIMESTAMP WITH TIME ZONE`,
    );

    // The reminder cron looks up "who has words due now", grouped by user.
    // Without this the job scans the whole review table every evening.
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_word_reviews_next_review_at"
       ON "word_reviews" ("next_review_at")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_word_reviews_next_review_at"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "last_reminder_at"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "push_enabled"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "expo_push_token"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "daily_goal_xp"`);
  }
}
