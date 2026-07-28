import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repairs a break in the migration chain (see `docs/CODE_AUDIT.md` §H1).
 *
 * `assignment_completions` was only ever created by `DB_SYNCHRONIZE=true` in
 * dev, so no migration creates it — yet `1785600000000-TeacherPanelPhase1`
 * ALTERs it. On any *fresh* environment (new Railway instance, staging, a local
 * DB with synchronize off) that ALTER throws, and because prod boots with
 * `DB_MIGRATIONS_RUN=true` the whole app fails to start.
 *
 * This migration is timestamped BEFORE TeacherPanelPhase1 so it runs first on a
 * fresh DB, and uses `IF NOT EXISTS` so it is a harmless no-op on prod (where
 * the table already exists). Columns here are the pre-TeacherPanelPhase1 shape;
 * that later migration adds status/score_pct/submitted_at/attempt_count on top.
 */
export class CreateAssignmentCompletions1785550000000
  implements MigrationInterface
{
  name = 'CreateAssignmentCompletions1785550000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "assignment_completions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "assignment_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        CONSTRAINT "PK_assignment_completions" PRIMARY KEY ("id")
      )
    `);

    // One row per (assignment, student) — mirrors @Unique on the entity.
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_assignment_completions_assignment_student"
      ON "assignment_completions" ("assignment_id", "student_id")
    `);

    // FKs are added only when absent: on prod the synchronize-created table
    // already carries them under TypeORM's generated names.
    await q.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'assignment_completions'
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name = 'FK_assignment_completions_assignment'
        ) THEN
          ALTER TABLE "assignment_completions"
            ADD CONSTRAINT "FK_assignment_completions_assignment"
            FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id")
            ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'assignment_completions'
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name = 'FK_assignment_completions_student'
        ) THEN
          ALTER TABLE "assignment_completions"
            ADD CONSTRAINT "FK_assignment_completions_student"
            FOREIGN KEY ("student_id") REFERENCES "users"("id")
            ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Only drops what this migration could have created. Deliberately does NOT
    // drop the table on an environment where it predates the migration chain.
    await q.query(
      `DROP INDEX IF EXISTS "UQ_assignment_completions_assignment_student"`,
    );
    await q.query(`DROP TABLE IF EXISTS "assignment_completions"`);
  }
}
