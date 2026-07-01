import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Exercise sub-category (сэдэв): add a free-text `topic` column to quizzes so a
 * standalone exercise can be grouped by сэдэв within its skill (the skill itself
 * stays in `category`). Mobile groups the skill's exercises by this value, and
 * admin authors it — the stored value IS the shown label, so both match.
 * Dev uses DB_SYNCHRONIZE=true (auto); prod runs DB_SYNCHRONIZE=false so this
 * migration adds it there.
 */
export class AddQuizTopic1782300000000 implements MigrationInterface {
  name = 'AddQuizTopic1782300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "topic" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_quizzes_topic" ON "quizzes" ("topic")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_quizzes_topic"`);
    await queryRunner.query(`ALTER TABLE "quizzes" DROP COLUMN IF EXISTS "topic"`);
  }
}
