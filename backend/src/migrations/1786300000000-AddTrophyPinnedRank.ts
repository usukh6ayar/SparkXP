import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a learner pin up to 5 of their trophies to their profile.
 *
 * The rank lives on `user_trophies` (not a slug list on `users`) so an unearned
 * trophy has no row to pin — the data model enforces "only what you won" for
 * free, and the partial index keeps the profile read a 5-row lookup.
 */
export class AddTrophyPinnedRank1786300000000 implements MigrationInterface {
  name = 'AddTrophyPinnedRank1786300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "user_trophies" ADD COLUMN IF NOT EXISTS "pinned_rank" smallint`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_trophies_pinned"
       ON "user_trophies" ("user_id", "pinned_rank")
       WHERE "pinned_rank" IS NOT NULL`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_user_trophies_pinned"`);
    await q.query(
      `ALTER TABLE "user_trophies" DROP COLUMN IF EXISTS "pinned_rank"`,
    );
  }
}
