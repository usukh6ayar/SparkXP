import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Referral (invite) system: give each user a shareable `referral_code` and a
 * self-referential `referred_by_id`, plus the `referral` value on the XP/Sparks
 * source enums. Dev uses DB_SYNCHRONIZE=true (auto); prod runs
 * DB_SYNCHRONIZE=false so this migration applies it there.
 *
 * Additive only. Existing users get a code lazily on their first visit to the
 * invite screen (their username also works as a code meanwhile), so there's no
 * backfill — the migration can't fail on a code collision.
 *
 * Note: Postgres enum values can't be dropped, so `down()` leaves the `referral`
 * enum values in place (same one-way pattern as earlier migrations).
 */
export class AddReferralSystem1782500000000 implements MigrationInterface {
  name = 'AddReferralSystem1782500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // --- User referral columns ---
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referred_by_id" uuid`,
    );
    // Unique only among users who have a code (partial index — NULLs allowed).
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_referral_code" ON "users" ("referral_code") WHERE "referral_code" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_referred_by_id" ON "users" ("referred_by_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_referred_by_id"
      FOREIGN KEY ("referred_by_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // --- New enum values (one-way; safe to re-run) ---
    await queryRunner.query(
      `ALTER TYPE "public"."xp_logs_source_enum" ADD VALUE IF NOT EXISTS 'referral'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."sparks_logs_source_enum" ADD VALUE IF NOT EXISTS 'referral'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_referred_by_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_users_referred_by_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_users_referral_code"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "referred_by_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "referral_code"`);
    // Enum values intentionally left in place (Postgres can't DROP VALUE).
  }
}
