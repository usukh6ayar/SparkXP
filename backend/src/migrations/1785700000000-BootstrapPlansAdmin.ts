import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

/**
 * Bootstrap essential prod data that used to live in the dev `seed` script:
 *
 * - **Subscription plans** (standard / plus / premier) — upserted by `slug`,
 *   so this is idempotent and never overwrites values an admin tuned later.
 * - **Super-admin** — created ONLY when `ADMIN_EMAIL` + `ADMIN_PASSWORD` env
 *   are set AND no admin/super_admin exists yet. No hardcoded password. On a
 *   prod DB that already has an admin this is a no-op.
 *
 * This lets us delete the seed scripts without losing prod-critical rows.
 */
export class BootstrapPlansAdmin1785700000000 implements MigrationInterface {
  name = 'BootstrapPlansAdmin1785700000000';

  public async up(q: QueryRunner): Promise<void> {
    // ── Plans (idempotent upsert by slug) ────────────────────────────────────
    const plans = [
      {
        slug: 'standard', name: 'Standard', price: 34000, days: 30,
        features: ['Бүх үндсэн хичээл', 'Өдрийн 20 AI мессеж', 'XP & Sparks'],
        voice: 25, stt: null, dict: 300, tokens: null, mem: 100,
      },
      {
        slug: 'plus', name: 'Plus', price: 56000, days: 30,
        features: ['Standard-ийн бүх давуу тал', '50 мин AI дуу хоолой', '700 AI толь бичиг/сар', '1.5x Sparks'],
        voice: 50, stt: 120, dict: 700, tokens: 400, mem: 250,
      },
      {
        slug: 'premier', name: 'Premier', price: 85000, days: 30,
        features: ['Plus-ийн бүх давуу тал', 'Хязгааргүй AI мессеж', 'Хоолойн AI (Voice)', 'Тэргүүлэх дэмжлэг'],
        voice: null, stt: null, dict: null, tokens: null, mem: null,
      },
    ];

    for (const p of plans) {
      await q.query(
        `INSERT INTO "plans"
           ("id", "name", "slug", "price_amount", "duration_days", "features",
            "is_active", "voice_minutes_limit", "stt_minutes_limit",
            "dictionary_ai_limit", "ai_text_tokens_limit", "memory_mb_limit")
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5::jsonb, true, $6, $7, $8, $9, $10)
         ON CONFLICT ("slug") DO NOTHING`,
        [
          p.name, p.slug, p.price, p.days, JSON.stringify(p.features),
          p.voice, p.stt, p.dict, p.tokens, p.mem,
        ],
      );
    }

    // ── Super-admin (env-driven, existence-guarded) ──────────────────────────
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (email && password) {
      const existing = await q.query(
        `SELECT 1 FROM "users" WHERE "role" IN ('admin', 'super_admin') LIMIT 1`,
      );
      if (existing.length === 0) {
        const hash = await bcrypt.hash(password, 10);
        await q.query(
          `INSERT INTO "users" ("id", "email", "password_hash", "full_name", "role", "email_verified")
           VALUES (uuid_generate_v4(), $1, $2, $3, 'super_admin', true)
           ON CONFLICT ("email") DO NOTHING`,
          [email, hash, 'SparkXP Admin'],
        );
      }
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    // Only remove the bootstrapped plans. The admin user is left untouched —
    // never auto-delete a real account on a rollback.
    await q.query(
      `DELETE FROM "plans" WHERE "slug" IN ('standard', 'plus', 'premier')`,
    );
  }
}
