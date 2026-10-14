import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * **Хэрэглэгчийг мэдээлэх / блоклох** — App Store guideline 1.2.
 *
 * Профайл зураг, нэр нь чансаанд бусдад харагддаг (user-generated content), тиймээс
 * Apple мэдээлэх ба блоклох боломжийг шаарддаг. Хоёр ШИНЭ хүснэгт:
 * - `user_reports` — хэн хэнийг ямар шалтгаанаар мэдээлсэн; админ шийднэ.
 * - `user_blocks` — блоклогч блоклогдсон хүнээ чансаанд харахгүй. Хос давтагдашгүй.
 *
 * Хоёр FK хоёулаа ON DELETE CASCADE → данс устгахад мөрүүд өөрөө цэвэрлэгдэнэ.
 */
export class AddUserReportsAndBlocks1788400000000 implements MigrationInterface {
  name = 'AddUserReportsAndBlocks1788400000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "user_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "reporter_id" uuid NOT NULL,
        "reported_id" uuid NOT NULL,
        "reason" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'open',
        "action" varchar,
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_user_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_reports_reporter" FOREIGN KEY ("reporter_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_reports_reported" FOREIGN KEY ("reported_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_reports_status" ON "user_reports" ("status")`,
    );
    await q.query(`
      CREATE TABLE IF NOT EXISTS "user_blocks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "blocker_id" uuid NOT NULL,
        "blocked_id" uuid NOT NULL,
        CONSTRAINT "PK_user_blocks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_blocks_pair" UNIQUE ("blocker_id", "blocked_id"),
        CONSTRAINT "FK_user_blocks_blocker" FOREIGN KEY ("blocker_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_blocks_blocked" FOREIGN KEY ("blocked_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "user_blocks"`);
    await q.query(`DROP TABLE IF EXISTS "user_reports"`);
  }
}
