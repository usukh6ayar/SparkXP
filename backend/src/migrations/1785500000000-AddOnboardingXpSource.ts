import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `onboarding` value to the XP source enum — the pre-signup taste-task
 * (C4) bonus, granted once when the account is first verified.
 *
 * Dev uses DB_SYNCHRONIZE=true (auto); prod runs DB_SYNCHRONIZE=false so this
 * migration applies it there. Additive + IF NOT EXISTS → safe to re-run.
 * Postgres enum values can't be dropped, so `down()` is a no-op (same one-way
 * pattern as AddReferralSystem).
 */
export class AddOnboardingXpSource1785500000000 implements MigrationInterface {
  name = 'AddOnboardingXpSource1785500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."xp_logs_source_enum" ADD VALUE IF NOT EXISTS 'onboarding'`,
    );
  }

  async down(): Promise<void> {
    // Enum values can't be dropped in Postgres — intentionally left in place.
  }
}
