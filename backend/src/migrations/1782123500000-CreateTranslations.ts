import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dictionary cache (Reading Phase 2): create the translations table that stores
 * AI-generated word explanations so each word hits Gemini only once. Dev
 * (DB_SYNCHRONIZE=true) gets it automatically; prod runs this migration.
 */
export class CreateTranslations1782123500000 implements MigrationInterface {
  name = 'CreateTranslations1782123500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "translations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "word" character varying NOT NULL,
        "translation" text NOT NULL,
        "audio_url" character varying,
        "source" character varying,
        CONSTRAINT "PK_translations_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_translations_word" ON "translations" ("word")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_translations_word"`);
    await queryRunner.query(`DROP TABLE "translations"`);
  }
}
