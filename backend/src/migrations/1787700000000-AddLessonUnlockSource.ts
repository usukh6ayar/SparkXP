import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `lesson_unlocks`-ыг хичээлийн хандалтын **цорын ганц бүртгэл** болгов.
 *
 * Өмнө нь энэ хүснэгт зөвхөн «Sparks-аар худалдаж авсан» гэсэн утгатай байв.
 * Одоо үнэгүй 3 эрх, багшийн даалгавар зэрэг бүх зам үүн рүү бичих тул
 * `source` багана нэмэгдэж, `sparks_spent` NULL зөвшөөрдөг боллоо (Sparks-аас
 * бусад эх сурвалжид «хэдэн Spark төлсөн бэ» гэдэг хариугүй асуулт).
 *
 * ⚠️ **Grandfather backfill.** Аль хэдийн хичээл дуусгасан хэрэглэгчид
 * маргааш нь түгжигдэх ёсгүй. `xp_logs`-оос (`source = 'lesson'`) хэн ямар
 * хичээл дуусгасныг олж, тэдгээрт `source = 'legacy'` мөр үүсгэнэ — эдгээр нь
 * үнэгүй эрхэнд тооцогдохгүй тул хуучин хэрэглэгч бүр дээрээс нь 3 шинэ
 * эрхтэй хэвээр үлдэнэ.
 *
 * Энэ migration ажиллахгүй бол хуучин хэрэглэгчид өөрсдийн үзсэн хичээлээ
 * алдана → Railway дээр `DB_MIGRATIONS_RUN=true` эсэхийг шалгаж байж deploy хий.
 *
 * down(): `legacy` ба `free`/`assignment` мөрүүдийг устгаад багануудыг буцаана.
 */
export class AddLessonUnlockSource1787700000000 implements MigrationInterface {
  name = 'AddLessonUnlockSource1787700000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      DO $$ BEGIN
        CREATE TYPE "lesson_unlocks_source_enum" AS ENUM ('sparks', 'free', 'assignment', 'legacy');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await q.query(`
      ALTER TABLE "lesson_unlocks"
        ADD COLUMN IF NOT EXISTS "source" "lesson_unlocks_source_enum" NOT NULL DEFAULT 'sparks'
    `);
    // Sparks-аас бусад эх сурвалжид утгагүй тул NULL зөвшөөрнө.
    await q.query(
      `ALTER TABLE "lesson_unlocks" ALTER COLUMN "sparks_spent" DROP NOT NULL`,
    );

    // Хуучин хэрэглэгчдийн дуусгасан хичээлүүд → үүрд нээлттэй.
    // `JOIN lessons` нь устсан хичээл рүү заасан хуучин XP мөрийг шүүнэ
    // (эс бөгөөс FK зөрчинө).
    await q.query(`
      INSERT INTO "lesson_unlocks" ("id", "user_id", "lesson_id", "sparks_spent", "source", "created_at", "updated_at")
      SELECT gen_random_uuid(), x."user_id", x."reference_id", NULL, 'legacy', now(), now()
      FROM (SELECT DISTINCT "user_id", "reference_id" FROM "xp_logs"
            WHERE "source" = 'lesson' AND "reference_id" IS NOT NULL) x
      JOIN "lessons" l ON l."id" = x."reference_id"
      ON CONFLICT ON CONSTRAINT "uq_lesson_unlock_user_lesson" DO NOTHING
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    // Зөвхөн энэ migration-ы үүсгэсэн болон шинэ замаар нэмэгдсэн мөрүүд —
    // Sparks-аар худалдаж авсан мөрүүд хөндөгдөхгүй.
    await q.query(
      `DELETE FROM "lesson_unlocks" WHERE "source" IN ('legacy', 'free', 'assignment')`,
    );
    await q.query(
      `UPDATE "lesson_unlocks" SET "sparks_spent" = 0 WHERE "sparks_spent" IS NULL`,
    );
    await q.query(
      `ALTER TABLE "lesson_unlocks" ALTER COLUMN "sparks_spent" SET NOT NULL`,
    );
    await q.query(`ALTER TABLE "lesson_unlocks" DROP COLUMN IF EXISTS "source"`);
    await q.query(`DROP TYPE IF EXISTS "lesson_unlocks_source_enum"`);
  }
}
