import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AI Buddy-гээс `emoji` баганыг устгав. Buddy-гийн дүрсийг одоо зөвхөн 3D GLB
 * загвар (`avatar_asset_url`) эсвэл thumbnail зургаар (`avatar_thumb_url`)
 * харуулна — emoji fallback хэрэггүй болсон.
 *
 * Dev (DB_SYNCHRONIZE=true) багана нь entity-ээс автоматаар унтарна; prod энэ
 * migration-ыг ажиллуулна. `IF EXISTS` тул давхар ажиллавал ч аюулгүй.
 *
 * down(): багануудыг буцааж нэмнэ (хуучин emoji утга сэргэхгүй — NOT NULL тул
 * түр зуурын хоосон мөр гарахгүйн тулд default '🤖' өгөв).
 */
export class DropAiBuddyEmoji1787500000000 implements MigrationInterface {
  name = 'DropAiBuddyEmoji1787500000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "ai_buddies" DROP COLUMN IF EXISTS "emoji"`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "ai_buddies" ADD COLUMN IF NOT EXISTS "emoji" character varying NOT NULL DEFAULT '🤖'`,
    );
  }
}
