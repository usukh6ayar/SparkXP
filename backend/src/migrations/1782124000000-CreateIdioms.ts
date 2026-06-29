import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Idioms feature: create the idioms table. Dev (DB_SYNCHRONIZE=true) gets it
 * automatically; prod (DB_SYNCHRONIZE=false) runs this migration.
 */
export class CreateIdioms1782124000000 implements MigrationInterface {
  name = 'CreateIdioms1782124000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "idioms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "phrase" character varying NOT NULL,
        "mongolian" character varying NOT NULL,
        "meaning" text,
        "definition" text,
        "example_sentence" text,
        "example_translation" text,
        "image_url" character varying,
        "audio_url" character varying,
        "is_published" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_idioms_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_idioms_published" ON "idioms" ("is_published")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_idioms_published"`);
    await queryRunner.query(`DROP TABLE "idioms"`);
  }
}
