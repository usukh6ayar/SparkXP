import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `notifications` хүснэгтийг хувь хүнд чиглэсэн мэдэгдэл дэмждэг болгов.
 *
 * Өмнө нь энэ хүснэгт зөвхөн админы broadcast байсан (`target_role`-оор
 * ролиор нарийсгадаг). Одоо багш даалгавар өгөхөд сурагч бүрд нэг мөр
 * үүсгэнэ — `user_id` дүүрсэн мөр = тухайн нэг хүнийх.
 *
 * `user_id IS NULL` = хуучин утгаараа broadcast, тиймээс байгаа бүх мөр
 * ажиллаж байгаа хэвээр (backfill шаардлагагүй).
 *
 * `data` нь deep link агуулна (`{ type: 'assignment', url: '/assignments' }`)
 * — апп мэдэгдэл дээр дарахад хаашаа очихыг үүгээр шийднэ.
 *
 * down(): хоёр багана + индексийг устгана. Хувийн мэдэгдлүүд мөрөөрөө үлдэх
 * тул `user_id` устахад тэдгээр нь бүх хүнд харагдах болно — иймд down()
 * ажиллуулахын өмнө тэдгээрийг цэвэрлэдэг.
 */
export class AddPersonalNotifications1787600000000 implements MigrationInterface {
  name = 'AddPersonalNotifications1787600000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "user_id" uuid`,
    );
    await q.query(
      `ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "data" jsonb`,
    );
    // Хэрэглэгч устахад түүний мэдэгдлүүд хамт устана.
    await q.query(`
      DO $$ BEGIN
        ALTER TABLE "notifications"
          ADD CONSTRAINT "fk_notifications_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    // "миний мэдэгдлүүд" query энэ индекс дээр суурилна.
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_notifications_user_id" ON "notifications" ("user_id")`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    // Хувийн мөрүүдийг эхлээд устгана — эс бөгөөс багана алга болмогц тэд
    // broadcast болж хувирч, бүх хэрэглэгчид харагдана.
    await q.query(`DELETE FROM "notifications" WHERE "user_id" IS NOT NULL`);
    await q.query(`DROP INDEX IF EXISTS "idx_notifications_user_id"`);
    await q.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "fk_notifications_user"`,
    );
    await q.query(`ALTER TABLE "notifications" DROP COLUMN IF EXISTS "data"`);
    await q.query(`ALTER TABLE "notifications" DROP COLUMN IF EXISTS "user_id"`);
  }
}
