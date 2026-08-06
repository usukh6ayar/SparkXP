import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Core-gamification tables (Task 1): lesson stars, star-gated level unlocks,
 * and Home events.
 *
 * - `user_lesson_stars` — 0–3 stars per (user, lesson), best kept. Permanent
 *   record of how well a lesson's test went.
 * - `level_requirements` — how many total stars each island/castle needs to
 *   unlock. Seeded with sensible defaults; admin-tunable (Core Rule: no
 *   hardcoded economy).
 * - `events` — Daily / Weekly challenge / Double XP, time-boxed and admin-run.
 *
 * Dev (DB_SYNCHRONIZE=true) gets the tables from the entities; the level-
 * requirement seed still runs here so both paths end up configured. Prod
 * (DB_SYNCHRONIZE=false) runs this migration.
 */
export class CreateGamificationTables1786800000000 implements MigrationInterface {
  name = 'CreateGamificationTables1786800000000';

  async up(q: QueryRunner): Promise<void> {
    // 1) Lesson stars
    await q.query(`
      CREATE TABLE IF NOT EXISTS "user_lesson_stars" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "lesson_id" uuid NOT NULL,
        "stars" smallint NOT NULL DEFAULT 0,
        CONSTRAINT "PK_user_lesson_stars_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_user_lesson_star" UNIQUE ("user_id", "lesson_id"),
        CONSTRAINT "FK_user_lesson_stars_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_lesson_stars_lesson" FOREIGN KEY ("lesson_id")
          REFERENCES "lessons"("id") ON DELETE CASCADE
      )
    `);

    // 2) Level requirements (star gates) + default seed
    await q.query(`
      CREATE TABLE IF NOT EXISTS "level_requirements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "level_code" character varying(8) NOT NULL,
        "stars_required" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_level_requirements_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_level_requirement_code" UNIQUE ("level_code")
      )
    `);
    await q.query(`
      INSERT INTO "level_requirements" ("level_code", "stars_required") VALUES
        ('a1', 0), ('a2', 3), ('b1', 9), ('b2', 18), ('c1', 30), ('c2', 45)
      ON CONFLICT ("level_code") DO NOTHING
    `);

    // 3) Events (+ its enum type)
    await q.query(`DO $$ BEGIN
      CREATE TYPE "events_type_enum" AS ENUM('daily', 'weekly_challenge', 'double_xp');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "type" "events_type_enum" NOT NULL,
        "title" character varying(120) NOT NULL,
        "description" character varying(400),
        "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "reward_xp" integer,
        "xp_multiplier" numeric(4,2),
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_events_id" PRIMARY KEY ("id")
      )
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_event_window" ON "events" ("starts_at", "ends_at")`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "events"`);
    await q.query(`DROP TYPE IF EXISTS "events_type_enum"`);
    await q.query(`DROP TABLE IF EXISTS "level_requirements"`);
    await q.query(`DROP TABLE IF EXISTS "user_lesson_stars"`);
  }
}
