import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pay-as-you-go AI Buddy minutes (2026-10-20).
 * - `voice_packs`: extra-minute packs sold on the website; admin-editable.
 * - `voice_credits`: append-only ledger (+bought / -spent seconds per type).
 * No packs are seeded — the owner sets names and prices from the admin.
 */
export class CreateVoicePacks1788600000000 implements MigrationInterface {
  name = 'CreateVoicePacks1788600000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "voice_packs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "name" varchar NOT NULL,
        "slug" varchar NOT NULL,
        "price_amount" int NOT NULL,
        "voice_minutes" int NOT NULL DEFAULT 0,
        "stt_minutes" int NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_voice_packs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_voice_packs_slug" UNIQUE ("slug")
      )
    `);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "voice_credits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "type" varchar NOT NULL,
        "seconds" int NOT NULL,
        "payment_id" uuid,
        CONSTRAINT "PK_voice_credits" PRIMARY KEY ("id"),
        CONSTRAINT "FK_voice_credits_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_voice_credits_user_type" ON "voice_credits" ("user_id", "type")`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "voice_credits"`);
    await q.query(`DROP TABLE IF EXISTS "voice_packs"`);
  }
}
