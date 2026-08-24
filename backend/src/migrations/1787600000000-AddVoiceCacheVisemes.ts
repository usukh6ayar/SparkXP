import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `buddy_voice_cache`-д `visemes` jsonb багана нэмэв.
 *
 * Azure HD Voice нь аудиотойгоо хамт уруулын хөдөлгөөний цагийн шугам
 * (`VisemeReceived` → viseme id + offset) буцаадаг. Түүнийг зөвхөн дуу үүсгэх
 * агшинд авах боломжтой тул cache-д хамт хадгалахгүй бол хамгийн олон давтагддаг
 * хэллэгүүд (cache hit) яг тэр үедээ жинхэнэ lip-sync-ээ алддаг.
 *
 * Хоосон (`NULL`) байж болно: Gemini TTS цаг өгдөггүй, мөн энэ багана нэмэгдэхээс
 * өмнө хадгалагдсан бүх мөр хоосон хэвээр үлдэнэ — апп тэр тохиолдолд хариултын
 * бичвэрээс амны хэлбэрийг таамагладаг хуучин замаараа явна.
 *
 * Dev (DB_SYNCHRONIZE=true) багана нь entity-ээс автоматаар үүснэ; prod энэ
 * migration-ыг ажиллуулна. `IF NOT EXISTS` тул давхар ажиллавал ч аюулгүй.
 */
export class AddVoiceCacheVisemes1787600000000 implements MigrationInterface {
  name = 'AddVoiceCacheVisemes1787600000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "buddy_voice_cache" ADD COLUMN IF NOT EXISTS "visemes" jsonb`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "buddy_voice_cache" DROP COLUMN IF EXISTS "visemes"`,
    );
  }
}
