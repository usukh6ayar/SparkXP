import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Expression indexes for the case-insensitive account lookups
 * (`docs/CODE_AUDIT.md` / ROADMAP §3).
 *
 * `users.username` and `users.email` are both indexed on the RAW value, so
 * `WHERE LOWER(username) = LOWER($1)` — what login, sign-up's duplicate check
 * and password reset all run — could not use them and fell back to a full scan
 * of the users table on every login attempt.
 *
 * **Deliberately NOT unique.** A unique index on `LOWER(username)` is the
 * stronger fix, but it FAILS to build if the table already holds case-variants
 * (`Bataa` + `bataa`), which the raw-value unique index has always allowed —
 * and a migration that throws on boot takes production down. Application code
 * (`UsersService.assertUsernameFree`) already rejects new case-collisions, so
 * this migration only has to make the reads fast.
 *
 * To upgrade to unique later, first confirm prod is clean:
 *
 *   select lower(username), count(*), array_agg(username)
 *   from users where username is not null group by 1 having count(*) > 1;
 *
 * (same query with `email`), merge any rows by hand, then replace these with
 * `CREATE UNIQUE INDEX`.
 */
export class AddLowerUsernameEmailIndexes1786400000000
  implements MigrationInterface
{
  name = 'AddLowerUsernameEmailIndexes1786400000000';

  public async up(q: QueryRunner): Promise<void> {
    // Partial, matching the existing username index: rows without a username
    // are never looked up by one, and keeping them out keeps the index small.
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_lower_username"
       ON "users" (LOWER("username")) WHERE "username" IS NOT NULL`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_lower_email" ON "users" (LOWER("email"))`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_users_lower_email"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_users_lower_username"`);
  }
}
