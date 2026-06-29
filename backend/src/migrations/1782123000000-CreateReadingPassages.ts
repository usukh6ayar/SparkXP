import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reading feature (M7): create the reading_passages table. Dev uses
 * DB_SYNCHRONIZE=true and gets this table automatically; prod runs
 * DB_SYNCHRONIZE=false so this migration creates it there.
 */
export class CreateReadingPassages1782123000000 implements MigrationInterface {
  name = 'CreateReadingPassages1782123000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."reading_passages_cefr_enum" AS ENUM('a1', 'a2', 'b1', 'b2', 'c1', 'c2')`,
    );
    await queryRunner.query(`
      CREATE TABLE "reading_passages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "title" character varying NOT NULL,
        "cefr" "public"."reading_passages_cefr_enum" NOT NULL DEFAULT 'a1',
        "word_count" integer NOT NULL DEFAULT '0',
        "estimated_reading_time" integer NOT NULL DEFAULT '0',
        "cover_image_url" character varying,
        "key_vocab" jsonb NOT NULL DEFAULT '[]',
        "sentences" jsonb NOT NULL DEFAULT '[]',
        "is_published" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_reading_passages_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_reading_passages_cefr" ON "reading_passages" ("cefr")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reading_passages_published" ON "reading_passages" ("is_published")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_reading_passages_published"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reading_passages_cefr"`);
    await queryRunner.query(`DROP TABLE "reading_passages"`);
    await queryRunner.query(`DROP TYPE "public"."reading_passages_cefr_enum"`);
  }
}
