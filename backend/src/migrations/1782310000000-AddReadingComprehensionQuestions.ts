import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reading comprehension: add a `comprehension_questions` jsonb column to
 * reading_passages. Questions (multiple_choice / fill_blank) are AI-generated
 * from the passage, admin-reviewed, and answered on mobile after finishing.
 * Dev uses DB_SYNCHRONIZE=true (auto); prod runs DB_SYNCHRONIZE=false so this
 * migration adds it there.
 */
export class AddReadingComprehensionQuestions1782310000000
  implements MigrationInterface
{
  name = 'AddReadingComprehensionQuestions1782310000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reading_passages" ADD COLUMN IF NOT EXISTS "comprehension_questions" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reading_passages" DROP COLUMN IF EXISTS "comprehension_questions"`,
    );
  }
}
