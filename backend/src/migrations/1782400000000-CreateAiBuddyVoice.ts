import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AI Buddy voice pipeline schema: buddy_sessions, buddy_memories,
 * buddy_voice_cache, safety_events + new voice/avatar columns on messages and
 * ai_buddies. Dev (DB_SYNCHRONIZE=true) gets this automatically; prod runs the
 * migration (DB_SYNCHRONIZE=false).
 */
export class CreateAiBuddyVoice1782400000000 implements MigrationInterface {
  name = 'CreateAiBuddyVoice1782400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // --- Enums (CREATE TYPE has no IF NOT EXISTS → guard with a DO block) ---
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "buddy_sessions_mode_enum" AS ENUM ('voice', 'text');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "buddy_memories_memory_type_enum" AS ENUM ('interest', 'goal', 'mistake_pattern', 'preference', 'level');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // --- buddy_sessions ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "buddy_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "buddy_slug" character varying NOT NULL,
        "topic" character varying,
        "mode" "buddy_sessions_mode_enum" NOT NULL DEFAULT 'voice',
        "ended_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_buddy_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_buddy_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_buddy_sessions_user" ON "buddy_sessions" ("user_id")`,
    );

    // --- buddy_memories ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "buddy_memories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "memory_type" "buddy_memories_memory_type_enum" NOT NULL,
        "value" text NOT NULL,
        "importance" integer NOT NULL DEFAULT 1,
        "source_message_id" uuid,
        "expires_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_buddy_memories_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_buddy_memories_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_buddy_memories_user" ON "buddy_memories" ("user_id")`,
    );

    // --- buddy_voice_cache ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "buddy_voice_cache" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "text_hash" character varying NOT NULL,
        "voice_id" character varying NOT NULL,
        "audio_url" character varying NOT NULL,
        "duration_ms" integer NOT NULL,
        "hit_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_buddy_voice_cache_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_buddy_voice_cache_hash_voice" ON "buddy_voice_cache" ("text_hash", "voice_id")`,
    );

    // --- safety_events ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "safety_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "session_id" uuid,
        "event_type" character varying NOT NULL,
        "severity" character varying NOT NULL DEFAULT 'low',
        "details" jsonb,
        CONSTRAINT "PK_safety_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_safety_events_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_safety_events_user" ON "safety_events" ("user_id")`,
    );

    // --- messages: AI Buddy voice columns ---
    await queryRunner.query(`
      ALTER TABLE "messages"
        ADD COLUMN IF NOT EXISTS "session_id" uuid,
        ADD COLUMN IF NOT EXISTS "buddy_slug" character varying,
        ADD COLUMN IF NOT EXISTS "audio_url" character varying,
        ADD COLUMN IF NOT EXISTS "duration_ms" integer,
        ADD COLUMN IF NOT EXISTS "raw_text" text,
        ADD COLUMN IF NOT EXISTS "metadata" jsonb
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_messages_session" ON "messages" ("session_id")`,
    );

    // --- ai_buddies: voice + avatar columns ---
    await queryRunner.query(`
      ALTER TABLE "ai_buddies"
        ADD COLUMN IF NOT EXISTS "voice_id" character varying,
        ADD COLUMN IF NOT EXISTS "tts_params" jsonb,
        ADD COLUMN IF NOT EXISTS "emotion_map" jsonb,
        ADD COLUMN IF NOT EXISTS "avatar_asset_url" character varying,
        ADD COLUMN IF NOT EXISTS "avatar_thumb_url" character varying
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_buddies"
        DROP COLUMN "voice_id",
        DROP COLUMN "tts_params",
        DROP COLUMN "emotion_map",
        DROP COLUMN "avatar_asset_url",
        DROP COLUMN "avatar_thumb_url"
    `);
    await queryRunner.query(`DROP INDEX "public"."IDX_messages_session"`);
    await queryRunner.query(`
      ALTER TABLE "messages"
        DROP COLUMN "session_id",
        DROP COLUMN "buddy_slug",
        DROP COLUMN "audio_url",
        DROP COLUMN "duration_ms",
        DROP COLUMN "raw_text",
        DROP COLUMN "metadata"
    `);
    await queryRunner.query(`DROP INDEX "public"."IDX_safety_events_user"`);
    await queryRunner.query(`DROP TABLE "safety_events"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_buddy_voice_cache_hash_voice"`);
    await queryRunner.query(`DROP TABLE "buddy_voice_cache"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_buddy_memories_user"`);
    await queryRunner.query(`DROP TABLE "buddy_memories"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_buddy_sessions_user"`);
    await queryRunner.query(`DROP TABLE "buddy_sessions"`);
    await queryRunner.query(`DROP TYPE "buddy_memories_memory_type_enum"`);
    await queryRunner.query(`DROP TYPE "buddy_sessions_mode_enum"`);
  }
}
