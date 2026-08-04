import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Data backfill for lessons authored before the admin form had the fields.
 *
 * 1) `thumbnail_url` — the admin used to save the cover only inside the
 *    `content` jsonb, so older lessons have `content.imageUrl` but a null
 *    `thumbnail_url`, and the app (which reads the column) showed no cover.
 * 2) `position` — the form never sent it, so most lessons sat at 0 and their
 *    order within a level was whatever the DB happened to return. Position is
 *    1-based (0 = "never ordered"), so every 0 is handed a slot AFTER the
 *    highest position already used in its level, in creation order. Lessons
 *    that were ordered by hand keep their exact place, and a second run is a
 *    no-op because no zeros are left.
 *
 * Pure data, no schema change → `down()` is intentionally a no-op (reverting
 * would throw away ordering the admin may have edited since).
 */
export class BackfillLessonOrderAndThumbnail1786600000000
  implements MigrationInterface
{
  name = 'BackfillLessonOrderAndThumbnail1786600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      UPDATE "lessons"
         SET "thumbnail_url" = "content" ->> 'imageUrl'
       WHERE "thumbnail_url" IS NULL
         AND "content" ->> 'imageUrl' IS NOT NULL
    `);

    await q.query(`
      WITH maxes AS (
        SELECT "level", "parent_lesson_id", max("position") AS max_pos
          FROM "lessons"
         GROUP BY "level", "parent_lesson_id"
      ), zeros AS (
        SELECT "id", "level", "parent_lesson_id",
               row_number() OVER (
                 PARTITION BY "level", "parent_lesson_id"
                 ORDER BY "created_at", "id"
               ) AS rn
          FROM "lessons"
         WHERE "position" = 0
      )
      UPDATE "lessons" l
         SET "position" = m.max_pos + z.rn
        FROM zeros z
        JOIN maxes m
          ON m."level" = z."level"
         AND m."parent_lesson_id" IS NOT DISTINCT FROM z."parent_lesson_id"
       WHERE l."id" = z."id"
    `);
  }

  public async down(): Promise<void> {
    // Data-only backfill — nothing to undo.
  }
}
