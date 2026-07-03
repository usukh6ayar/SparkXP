/**
 * Referral reward amounts. Kept in one place so they're easy to tune (and could
 * later move to the admin/DB-configurable limits blob without touching logic).
 */
export const REFERRAL = {
  /** XP for the newly-registered friend, granted after email verification. */
  SIGNUP_XP_INVITEE: 50,
  /** XP for the inviter, granted when their friend verifies. */
  SIGNUP_XP_INVITER: 50,
  /** Sparks for the inviter when the invited friend makes their first purchase. */
  FIRST_PURCHASE_SPARKS: 200,
} as const;

/** Prefix + alphabet for generated referral codes (ambiguous chars removed). */
export const REFERRAL_CODE_PREFIX = 'SPARK-';
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const REFERRAL_CODE_LENGTH = 5;
