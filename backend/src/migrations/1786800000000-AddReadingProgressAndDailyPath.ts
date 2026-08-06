import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReadingProgressAndDailyPath1786800000000 implements MigrationInterface {
  name = 'AddReadingProgressAndDailyPath1786800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TYPE "public"."sparks_logs_source_enum" ADD VALUE IF NOT EXISTS 'daily_path'`,
    );
    await q.query(`
      CREATE TABLE IF NOT EXISTS "reading_progress" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "passage_id" uuid NOT NULL,
        "sentence_index" integer NOT NULL DEFAULT 0,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_reading_progress" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reading_progress_user_passage" UNIQUE ("user_id", "passage_id")
      )
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reading_progress_user_updated" ON "reading_progress" ("user_id", "updated_at")`,
    );
    await q.query(`
      ALTER TABLE "reading_progress"
      ADD CONSTRAINT "FK_reading_progress_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await q.query(`
      ALTER TABLE "reading_progress"
      ADD CONSTRAINT "FK_reading_progress_passage"
      FOREIGN KEY ("passage_id") REFERENCES "reading_passages"("id") ON DELETE CASCADE
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "reading_progress"`);
    // PostgreSQL enum values cannot be safely removed without recreating the type.
  }
}
