import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two independent improvements:
 *
 * 1. **Streak freezes** — a Sparks sink that protects a streak across a missed
 *    day. Losing a streak is the biggest single reason learners quit.
 *
 * 2. **`xp_logs (user_id, created_at)` index** (docs/CODE_AUDIT.md §M4) —
 *    leaderboards filter this append-only ledger by a date window and group by
 *    user. Only `user_id` was indexed, so every weekly/monthly board scanned
 *    the whole table, and the table only ever grows.
 */
export class AddStreakFreezeAndXpIndex1786000000000
  implements MigrationInterface
{
  name = 'AddStreakFreezeAndXpIndex1786000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "streak_freezes" integer NOT NULL DEFAULT 0`,
    );
    await q.query(
      `ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "streak_freeze_sparks" integer`,
    );

    // CONCURRENTLY is not used: TypeORM wraps migrations in a transaction and
    // Postgres forbids it there. The table is small enough today that a brief
    // lock is fine — revisit if xp_logs grows into the millions.
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_xp_logs_user_created"
       ON "xp_logs" ("user_id", "created_at")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_xp_logs_user_created"`);
    await q.query(`ALTER TABLE "plans" DROP COLUMN IF EXISTS "streak_freeze_sparks"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "streak_freezes"`);
  }
}
