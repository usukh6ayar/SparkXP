import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The word's own Mongolian meaning on a Толь entry — the line shown under the
 * headword in the app ("гүйх; ажиллуулах; урсах").
 *
 * Nullable on purpose: rows cached before this column existed keep their senses
 * and are filled in lazily, one word at a time, on the next search (see
 * `DictionarySensesService.translationFor`). No bulk regeneration, so no AI
 * spend on words nobody looks up again.
 */
export class AddDictionaryEntryTranslation1786700000000
  implements MigrationInterface
{
  name = 'AddDictionaryEntryTranslation1786700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "dictionary_entries" ADD COLUMN IF NOT EXISTS "translation" character varying(200)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "dictionary_entries" DROP COLUMN IF EXISTS "translation"`,
    );
  }
}
