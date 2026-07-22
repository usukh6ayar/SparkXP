import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Teacher Panel 2.0 — Phase 1.
 * - New `quiz_attempts` table (persisted quiz score + normalized skill).
 * - `assignments` gains `note` + `student_ids` (subset targeting).
 * - `assignment_completions` becomes a submission record
 *   (status / score_pct / submitted_at / attempt_count). Existing rows only
 *   ever existed on completion, so `status` defaults to 'completed'.
 */
export class TeacherPanelPhase11785600000000 implements MigrationInterface {
  name = 'TeacherPanelPhase11785600000000';

  public async up(q: QueryRunner): Promise<void> {
    // quiz_attempts
    await q.query(`CREATE TABLE "quiz_attempts" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "user_id" uuid NOT NULL,
      "quiz_id" uuid NOT NULL,
      "skill" character varying NOT NULL,
      "correct_count" integer NOT NULL DEFAULT 0,
      "total_count" integer NOT NULL DEFAULT 0,
      "score_pct" integer NOT NULL DEFAULT 0,
      "assignment_id" uuid,
      CONSTRAINT "PK_quiz_attempts" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_qa_user_skill" ON "quiz_attempts" ("user_id","skill")`);
    await q.query(`CREATE INDEX "IDX_qa_user_created" ON "quiz_attempts" ("user_id","created_at")`);
    await q.query(`CREATE INDEX "IDX_qa_assignment" ON "quiz_attempts" ("assignment_id")`);
    await q.query(`ALTER TABLE "quiz_attempts" ADD CONSTRAINT "FK_qa_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);
    await q.query(`ALTER TABLE "quiz_attempts" ADD CONSTRAINT "FK_qa_quiz" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE`);

    // assignments: note + student_ids
    await q.query(`ALTER TABLE "assignments" ADD "note" character varying`);
    await q.query(`ALTER TABLE "assignments" ADD "student_ids" jsonb`);

    // assignment_completions → submission record
    await q.query(`CREATE TYPE "public"."assignment_completions_status_enum" AS ENUM('assigned','completed','late')`);
    await q.query(`ALTER TABLE "assignment_completions" ADD "status" "public"."assignment_completions_status_enum" NOT NULL DEFAULT 'completed'`);
    await q.query(`ALTER TABLE "assignment_completions" ADD "score_pct" integer`);
    await q.query(`ALTER TABLE "assignment_completions" ADD "submitted_at" TIMESTAMP WITH TIME ZONE`);
    await q.query(`ALTER TABLE "assignment_completions" ADD "attempt_count" integer NOT NULL DEFAULT 0`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "assignment_completions" DROP COLUMN "attempt_count"`);
    await q.query(`ALTER TABLE "assignment_completions" DROP COLUMN "submitted_at"`);
    await q.query(`ALTER TABLE "assignment_completions" DROP COLUMN "score_pct"`);
    await q.query(`ALTER TABLE "assignment_completions" DROP COLUMN "status"`);
    await q.query(`DROP TYPE "public"."assignment_completions_status_enum"`);
    await q.query(`ALTER TABLE "assignments" DROP COLUMN "student_ids"`);
    await q.query(`ALTER TABLE "assignments" DROP COLUMN "note"`);
    await q.query(`DROP TABLE "quiz_attempts"`);
  }
}
