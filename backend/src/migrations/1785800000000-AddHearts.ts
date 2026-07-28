import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Duolingo-style hearts (quiz lives).
 *
 * - `users.hearts` is a LAZY counter: only accurate as of `hearts_updated_at`.
 *   `HeartsService` folds in the hearts regenerated since that anchor, so no
 *   cron job has to tick every user's row on a schedule.
 * - The `plans.*` columns keep the economy tunable from admin without an app
 *   update (CLAUDE.md core rule). NULL means "use the free-tier default"
 *   (5 hearts / 240 min per heart / 50 Sparks to refill).
 *
 * Existing users start with a full 5 hearts and a NULL anchor (= full, nothing
 * regenerating), so the feature switches on without stranding anyone at zero.
 */
export class AddHearts1785800000000 implements MigrationInterface {
  name = 'AddHearts1785800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hearts" integer NOT NULL DEFAULT 5`,
    );
    await q.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hearts_updated_at" TIMESTAMP WITH TIME ZONE`,
    );

    await q.query(
      `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "unlimited_hearts" boolean NOT NULL DEFAULT false`,
    );
    await q.query(
      `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "max_hearts" integer`,
    );
    await q.query(
      `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "heart_regen_minutes" integer`,
    );
    await q.query(
      `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "heart_refill_sparks" integer`,
    );

    // Paid plans get unlimited hearts by default — the premium perk. Admin can
    // flip any of this per plan afterwards.
    await q.query(
      `UPDATE "plans" SET "unlimited_hearts" = true WHERE "price_amount" > 0`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "plans" DROP COLUMN IF EXISTS "heart_refill_sparks"`);
    await q.query(`ALTER TABLE "plans" DROP COLUMN IF EXISTS "heart_regen_minutes"`);
    await q.query(`ALTER TABLE "plans" DROP COLUMN IF EXISTS "max_hearts"`);
    await q.query(`ALTER TABLE "plans" DROP COLUMN IF EXISTS "unlimited_hearts"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "hearts_updated_at"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "hearts"`);
  }
}
