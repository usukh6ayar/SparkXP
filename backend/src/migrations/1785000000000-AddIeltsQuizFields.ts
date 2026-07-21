import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIeltsQuizFields1785000000000 implements MigrationInterface {
  name = 'AddIeltsQuizFields1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "passage_text" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "audio_url" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "quizzes" DROP COLUMN IF EXISTS "audio_url"`);
    await queryRunner.query(`ALTER TABLE "quizzes" DROP COLUMN IF EXISTS "passage_text"`);
  }
}
