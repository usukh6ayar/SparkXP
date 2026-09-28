import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * **Essential багцын дуут лимит** — voice cost brief (2026-09-26):
 * STT 100 мин (хэрэглэгчийн яриа), TTS 35 мин (Spark-ийн яриа) / сар.
 *
 * Апп дээр «Essential» гэж харагддаг нь `standard` мөр (34,000₮). Багц
 * засах admin endpoint байхгүй тул өгөгдлийн migration-оор тохируулав.
 * Багцгүй / хугацаа нь дууссан хэрэглэгч ч энэ лимитийг авна
 * (`buddy-usage.service.ts` → `capsInForce`).
 *
 * Down нь өмнөх утга руу (TTS 25, STT хязгааргүй) буцаана.
 */
export class SetEssentialVoiceLimits1788100000000 implements MigrationInterface {
  name = 'SetEssentialVoiceLimits1788100000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `UPDATE "plans" SET "voice_minutes_limit" = 35, "stt_minutes_limit" = 100 WHERE "slug" = 'standard'`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `UPDATE "plans" SET "voice_minutes_limit" = 25, "stt_minutes_limit" = NULL WHERE "slug" = 'standard'`,
    );
  }
}
