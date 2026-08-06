import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AI Buddy Background Shop (Task/Feature 1). `buddy_backgrounds` = the admin
 * catalog (Sparks-priced, optional premium + seasonal window); the equipped
 * scene shown behind the buddy. `user_buddy_backgrounds` = what a user owns and
 * which one is equipped (unique per user+background).
 *
 * Dev (DB_SYNCHRONIZE=true) gets these from the entities; prod runs this.
 */
export class CreateBuddyBackgrounds1787000000000 implements MigrationInterface {
  name = 'CreateBuddyBackgrounds1787000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "buddy_backgrounds" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "name" character varying(120) NOT NULL,
        "image_url" character varying NOT NULL,
        "price_sparks" integer NOT NULL DEFAULT 0,
        "is_premium" boolean NOT NULL DEFAULT false,
        "seasonal_start" TIMESTAMP WITH TIME ZONE,
        "seasonal_end" TIMESTAMP WITH TIME ZONE,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_buddy_backgrounds_id" PRIMARY KEY ("id")
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "user_buddy_backgrounds" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "background_id" uuid NOT NULL,
        "equipped" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_user_buddy_backgrounds_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_user_buddy_background" UNIQUE ("user_id", "background_id"),
        CONSTRAINT "FK_ubb_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ubb_background" FOREIGN KEY ("background_id")
          REFERENCES "buddy_backgrounds"("id") ON DELETE CASCADE
      )
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "user_buddy_backgrounds"`);
    await q.query(`DROP TABLE IF EXISTS "buddy_backgrounds"`);
  }
}
