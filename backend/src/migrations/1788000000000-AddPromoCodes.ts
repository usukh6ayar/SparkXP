import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * **Promo код + influencer эрх** (даалгавар #5, #6).
 *
 * Хоёр ШИНЭ хүснэгт — байгаа хүснэгт хөндөгдөхгүй:
 * - `promo_codes` — админы үүсгэсэн код/кампанит ажил. `used_count` нь
 *   `usage_limit`-ийг нэг UPDATE дотор шалгаж нэмэгддэг кэш.
 * - `promo_redemptions` — хэн, хэзээ ашигласан түүх. (promo, user) давтагдашгүй.
 *
 * Хэрэглэгчийн эрх нь байгаа `users.plan_id` + `plan_expires_at`-аар олгогдоно
 * (уншихдаа хугацааг шалгадаг) тул 7 хоногийн influencer эрх cron-гүйгээр өөрөө
 * дуусна.
 */
export class AddPromoCodes1788000000000 implements MigrationInterface {
  name = 'AddPromoCodes1788000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "promo_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "name" varchar NOT NULL,
        "code" varchar NOT NULL,
        "kind" varchar NOT NULL,
        "value" int NOT NULL,
        "plan_id" uuid,
        "valid_from" TIMESTAMP WITH TIME ZONE,
        "valid_until" TIMESTAMP WITH TIME ZONE,
        "usage_limit" int,
        "used_count" int NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "audience" varchar NOT NULL DEFAULT 'general',
        "assigned_user_id" uuid,
        "note" text,
        CONSTRAINT "PK_promo_codes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_promo_codes_code" UNIQUE ("code"),
        CONSTRAINT "FK_promo_codes_plan" FOREIGN KEY ("plan_id")
          REFERENCES "plans"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_promo_codes_assigned_user" FOREIGN KEY ("assigned_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "promo_redemptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "promo_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "access_until" TIMESTAMP WITH TIME ZONE,
        "payment_id" uuid,
        CONSTRAINT "PK_promo_redemptions" PRIMARY KEY ("id"),
        CONSTRAINT "uq_promo_redemption_promo_user" UNIQUE ("promo_id", "user_id"),
        CONSTRAINT "FK_promo_redemptions_promo" FOREIGN KEY ("promo_id")
          REFERENCES "promo_codes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_promo_redemptions_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_promo_redemptions_user" ON "promo_redemptions" ("user_id")`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "promo_redemptions"`);
    await q.query(`DROP TABLE IF EXISTS "promo_codes"`);
  }
}
