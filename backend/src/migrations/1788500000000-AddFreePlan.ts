import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Free Basic (client doc 09, 2026-09-28): the limits for everyone without an
 * active plan. Before this, such users got Essential's voice caps (35 TTS /
 * 100 STT min) and an unlimited AI dictionary — a paid tier for 0₮.
 *
 * The doc leaves the exact numbers open; these are the owner's interim
 * "tight" values (2026-10-20), kept under the 1,000₮/user/month target.
 * Admin-editable later; `is_active = false` keeps it off every sales page.
 * ON CONFLICT keeps any values an admin already set.
 */
export class AddFreePlan1788500000000 implements MigrationInterface {
  name = 'AddFreePlan1788500000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      INSERT INTO "plans"
        ("name", "slug", "price_amount", "is_active",
         "voice_minutes_limit", "stt_minutes_limit", "dictionary_ai_limit")
      VALUES ('Free Basic', 'free', 0, false, 5, 10, 30)
      ON CONFLICT ("slug") DO NOTHING
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM "plans" WHERE "slug" = 'free'`);
  }
}
