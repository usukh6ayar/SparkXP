import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * **Даалгаврын сан** — багш л хардаг, сурагч зөвхөн даалгавраар авдаг контент.
 *
 * Хоёр багана:
 * - `quizzes.assign_only` — `true` бол сурагчийн бүх зам (жагсаалт · нээх ·
 *   шалгах · илгээх) хаагдана. Анхдагч `false` тул **байгаа бүх дасгал урьдын
 *   адил нээлттэй хэвээр** үлдэнэ.
 * - `assignments.question_indexes` — багшийн сонгосон асуултын индексүүд.
 *   `NULL` = бүх асуулт, тиймээс **өмнө өгсөн бүх даалгавар яг хэвээрээ**
 *   ажиллана.
 *
 * Backfill байхгүй: хоёулаа зөвхөн шинэ контент/шинэ даалгаварт хамаарна.
 *
 * ⚠️ Railway дээр `DB_MIGRATIONS_RUN=true` эсэхийг шалгаж байж deploy хий —
 * эс бөгөөс админы «Зөвхөн даалгавраар» checkbox нь байхгүй багана руу бичих
 * гэж оролдоод 500 өгнө.
 */
export class AddAssignmentBank1787800000000 implements MigrationInterface {
  name = 'AddAssignmentBank1787800000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "quizzes"
        ADD COLUMN IF NOT EXISTS "assign_only" boolean NOT NULL DEFAULT false
    `);
    await q.query(`
      ALTER TABLE "assignments"
        ADD COLUMN IF NOT EXISTS "question_indexes" jsonb
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "assignments" DROP COLUMN IF EXISTS "question_indexes"`,
    );
    await q.query(`ALTER TABLE "quizzes" DROP COLUMN IF EXISTS "assign_only"`);
  }
}
