import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Толь (AI dictionary) tables.
 *
 * `dictionary_entries` caches the 4-sense search result per word so the same
 * word is only ever sent to Gemini once. `user_dictionary_saves` holds the ⭐
 * a student puts on a word — previously that created a `needs_review` row in
 * the curated `words` bank, which polluted the admin Words page.
 *
 * Dev (DB_SYNCHRONIZE=true) gets both from the entities; prod runs this.
 */
export class CreateDictionaryEntries1786500000000
  implements MigrationInterface
{
  name = 'CreateDictionaryEntries1786500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dictionary_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "word" character varying NOT NULL,
        "senses" jsonb NOT NULL DEFAULT '[]',
        "search_count" integer NOT NULL DEFAULT 0,
        "last_searched_at" TIMESTAMP WITH TIME ZONE,
        "source" character varying,
        "edited" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_dictionary_entries_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dictionary_entries_word" ON "dictionary_entries" ("word")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_dictionary_saves" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "word" character varying NOT NULL,
        CONSTRAINT "PK_user_dictionary_saves_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_dictionary_saves_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_user_dictionary_save" UNIQUE ("user_id", "word")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_dictionary_saves"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dictionary_entries"`);
  }
}
