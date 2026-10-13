import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plans as approved by the client on 2026-09-28 (docs 01–03):
 * Essential 34k (name only — slug `standard` stays; the app already calls it
 * Essential), Plus 56k → 70 TTS / 200 STT min, Premier 85k → 105 / 300.
 * The website now sells these, so what we sell must match what we deliver.
 */
export class PlansMatchClientBrief1788300000000 implements MigrationInterface {
  name = 'PlansMatchClientBrief1788300000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `UPDATE "plans" SET "name" = 'Essential' WHERE "slug" = 'standard'`,
    );
    await q.query(
      `UPDATE "plans" SET "voice_minutes_limit" = 70, "stt_minutes_limit" = 200 WHERE "slug" = 'plus'`,
    );
    await q.query(
      `UPDATE "plans" SET "voice_minutes_limit" = 105, "stt_minutes_limit" = 300 WHERE "slug" = 'premier'`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `UPDATE "plans" SET "name" = 'Standard' WHERE "slug" = 'standard'`,
    );
    await q.query(
      `UPDATE "plans" SET "voice_minutes_limit" = 50, "stt_minutes_limit" = 120 WHERE "slug" = 'plus'`,
    );
    await q.query(
      `UPDATE "plans" SET "voice_minutes_limit" = NULL, "stt_minutes_limit" = NULL WHERE "slug" = 'premier'`,
    );
  }
}
