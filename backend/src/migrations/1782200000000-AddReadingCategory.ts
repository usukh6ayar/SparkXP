import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reading topics (сэдэв): add a free-text `category` column to reading_passages
 * so passages can be grouped/tabbed by topic on mobile and filtered in admin.
 * Dev uses DB_SYNCHRONIZE=true and gets the column automatically; prod runs
 * DB_SYNCHRONIZE=false so this migration adds it there.
 */
export class AddReadingCategory1782200000000 implements MigrationInterface {
  name = 'AddReadingCategory1782200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reading_passages" ADD COLUMN IF NOT EXISTS "category" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reading_passages_category" ON "reading_passages" ("category")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_reading_passages_category"`);
    await queryRunner.query(`ALTER TABLE "reading_passages" DROP COLUMN IF EXISTS "category"`);
  }
}
