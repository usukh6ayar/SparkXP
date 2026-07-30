import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `user_trophies` — one row per (user, earned trophy).
 *
 * Replaces the `users.trophies` jsonb column, which was never written to by any
 * code. A real table is required because trophy checks run concurrently after
 * every XP award: the unique index turns awarding into an atomic
 * `INSERT ... ON CONFLICT DO NOTHING` instead of a lossy read-modify-write.
 *
 * `IF NOT EXISTS` throughout so re-running is harmless.
 */
export class CreateUserTrophies1786100000000 implements MigrationInterface {
  name = 'CreateUserTrophies1786100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "user_trophies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "slug" character varying NOT NULL,
        "seen_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_user_trophies" PRIMARY KEY ("id")
      )
    `);

    // One row per (user, trophy) — mirrors @Unique on the entity and makes
    // ON CONFLICT DO NOTHING possible.
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_trophies_user_slug"
      ON "user_trophies" ("user_id", "slug")
    `);

    // Serves "which trophies has this user earned" and the unseen lookup.
    await q.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_trophies_user_seen"
      ON "user_trophies" ("user_id", "seen_at")
    `);

    await q.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'user_trophies'
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name = 'FK_user_trophies_user'
        ) THEN
          ALTER TABLE "user_trophies"
            ADD CONSTRAINT "FK_user_trophies_user"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_user_trophies_user_seen"`);
    await q.query(`DROP INDEX IF EXISTS "UQ_user_trophies_user_slug"`);
    await q.query(`DROP TABLE IF EXISTS "user_trophies"`);
  }
}
