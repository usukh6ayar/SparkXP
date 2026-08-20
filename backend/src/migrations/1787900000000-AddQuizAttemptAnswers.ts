import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * **Сурагч юун дээр алдав** — `quiz_attempts.answers`.
 *
 * Урьд нь нэг илгээлтээс зөвхөн тоо (`correct_count` / `score_pct`) үлддэг
 * байсан тул багш «6/10» гэдгээс цааш юу ч мэдэх боломжгүй байв: аль асуулт
 * дээр, юу гэж хариулснаа хэн ч харж чадахгүй.
 *
 * Хэлбэр: `[{ i, a, ok }]` — `i` = сурагчийн харсан дарааллын индекс,
 * `a` = өгсөн хариулт (сонголтын дугаар эсвэл бичсэн текст), `ok` = зөв эсэх.
 *
 * `NULL` зөвшөөрөгдөнө: **хуучин илгээлтүүд хэвээр үлдэнэ** (backfill хийх
 * боломжгүй — хариултууд нь хаана ч хадгалагдаагүй), тэдгээрт апп
 * «дэлгэрэнгүй алга» гэж харуулна.
 *
 * ⚠️ Railway дээр `DB_MIGRATIONS_RUN=true` эсэхийг шалгаж байж deploy хий.
 */
export class AddQuizAttemptAnswers1787900000000 implements MigrationInterface {
  name = 'AddQuizAttemptAnswers1787900000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "quiz_attempts"
        ADD COLUMN IF NOT EXISTS "answers" jsonb
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "quiz_attempts" DROP COLUMN IF EXISTS "answers"`,
    );
  }
}
