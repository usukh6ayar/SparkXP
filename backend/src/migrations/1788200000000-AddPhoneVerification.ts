import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phone sign-up (verify.mn) — spec 2026-10-13.
 *
 * - `email` becomes optional (phone-registered accounts may have none).
 * - `phone_verified_at` marks a phone proven by SMS.
 * - One verified phone = one account: partial unique index. Unverified legacy
 *   `phone` values (nothing writes them today) never block anyone.
 *
 * Down refuses to run while any account has no email (it would fail anyway on
 * SET NOT NULL — this just says why).
 */
export class AddPhoneVerification1788200000000 implements MigrationInterface {
  name = 'AddPhoneVerification1788200000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`);
    await q.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_verified_at" TIMESTAMPTZ NULL`,
    );
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_verified_phone" ON "users" ("phone") WHERE "phone_verified_at" IS NOT NULL`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    const [{ n }] = await q.query(
      `SELECT COUNT(*)::int AS n FROM "users" WHERE "email" IS NULL`,
    );
    if (n > 0)
      throw new Error(
        `${n} account(s) have no email — cannot restore NOT NULL`,
      );
    await q.query(`DROP INDEX IF EXISTS "UQ_users_verified_phone"`);
    await q.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "phone_verified_at"`,
    );
    await q.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`);
  }
}
