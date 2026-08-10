import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mark existing admin / super-admin accounts as email-verified.
 *
 * **Why.** `login` now refuses an account whose email was never confirmed
 * (403 `EMAIL_NOT_VERIFIED`) — before that it ignored the flag entirely, so a
 * user could back out of the OTP screen and sign in anyway. Correct for
 * students, but it locked out admin accounts that predate the rule: the
 * original seed created `admin@englishxp.mn` with `email_verified = false`, and
 * the bootstrap migration only started setting it true later. The owner was
 * shut out of their own admin panel by a flag they were never asked about.
 *
 * **Why this is safe.** An admin role cannot be self-assigned: public
 * `POST /auth/register` is hard-locked to `student` (`RegisterDto` `@IsIn`), so
 * every admin row was either created by the bootstrap migration or promoted by
 * an existing admin. The address was already vouched for by a human; an OTP
 * adds nothing.
 *
 * **Why data and not a login exemption.** Skipping the check for admins would
 * make the rule depend on a mutable role, and would keep quietly re-appearing
 * for anyone who reads `login` later. Fixing the rows once leaves exactly one
 * rule at the door: verified or not.
 *
 * Idempotent — a no-op when every admin is already verified. Not reversible on
 * purpose: `down` cannot know which rows it flipped, and un-verifying an admin
 * would only recreate the lockout.
 */
export class VerifyExistingAdmins1787300000000 implements MigrationInterface {
  name = 'VerifyExistingAdmins1787300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `UPDATE "users"
          SET "email_verified" = true
        WHERE "role" IN ('admin', 'super_admin')
          AND "email_verified" = false`,
    );
  }

  public async down(): Promise<void> {
    // Intentionally empty — see the note above.
  }
}
