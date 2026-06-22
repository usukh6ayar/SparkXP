import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWordImageGenerationSupport1782122492000
  implements MigrationInterface
{
  name = 'AddWordImageGenerationSupport1782122492000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "words"
      ADD COLUMN IF NOT EXISTS "spark_tip" text
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."ai_usages_type_enum"
      ADD VALUE IF NOT EXISTS 'image_generation'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "words"
      DROP COLUMN IF EXISTS "spark_tip"
    `);
  }
}
