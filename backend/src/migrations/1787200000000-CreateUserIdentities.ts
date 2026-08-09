import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Google / Apple sign-in.
 *
 * - `user_identities` links a provider's stable `sub` to an account. Keyed on
 *   (provider, provider_user_id), never on email — an address can be reassigned,
 *   and Apple's relay addresses differ per app.
 * - `users.password_hash` becomes NULLABLE: an account created through a
 *   provider has no password at all. Existing rows are untouched.
 *
 * Reversible. `down` refuses to run if any password-less account exists, rather
 * than inventing a hash for it — that would lock real users out silently.
 */
export class CreateUserIdentities1787200000000 implements MigrationInterface {
  name = 'CreateUserIdentities1787200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "user_identities" (
        "id"               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
        "user_id"          uuid NOT NULL,
        "provider"         varchar(16) NOT NULL,
        "provider_user_id" varchar NOT NULL,
        "provider_email"   varchar,
        CONSTRAINT "UQ_user_identity_provider_sub" UNIQUE ("provider", "provider_user_id"),
        CONSTRAINT "FK_user_identity_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Every sign-in looks up by (provider, sub) — covered by the unique
    // constraint — and account screens list a user's linked providers.
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_identity_user" ON "user_identities" ("user_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "user_identities"`);

    const [{ count }] = (await q.query(
      `SELECT COUNT(*)::int AS count FROM "users" WHERE "password_hash" IS NULL`,
    )) as [{ count: number }];
    if (count > 0) {
      throw new Error(
        `Cannot restore NOT NULL on users.password_hash: ${count} account(s) ` +
          `sign in with Google/Apple only and have no password. Give them one ` +
          `(or delete them) before rolling this migration back.`,
      );
    }
    await q.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`);
  }
}
