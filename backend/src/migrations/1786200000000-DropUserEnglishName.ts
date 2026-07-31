import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops `users.english_name`.
 *
 * The "Англи нэр" feature was removed from the product — the field is gone from
 * the register / edit-profile forms, the DTOs and the auth response, and the
 * home greeting now uses `username`.
 *
 * `IF EXISTS` because dev machines run `DB_SYNCHRONIZE=true`: on any box that
 * has booted `start:dev` since the entity property was removed, synchronize has
 * already dropped the column, and a bare `DROP COLUMN` would throw there. Prod
 * (`DB_SYNCHRONIZE=false`) still has the column and this is what removes it.
 *
 * ⚠️ `down()` restores the COLUMN, not the DATA. Every stored English name is
 * lost permanently when this runs — reverting gives you an empty nullable
 * column back so the schema matches, nothing more.
 */
export class DropUserEnglishName1786200000000 implements MigrationInterface {
  name = 'DropUserEnglishName1786200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "english_name"`);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Nullable with no default — matches the original column definition.
    await q.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "english_name" character varying`,
    );
  }
}
