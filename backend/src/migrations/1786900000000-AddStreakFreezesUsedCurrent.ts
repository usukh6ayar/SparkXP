import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStreakFreezesUsedCurrent1786900000000
  implements MigrationInterface
{
  name = 'AddStreakFreezesUsedCurrent1786900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "streak_freezes_used_current" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "streak_freezes_used_current"`,
    );
  }
}
