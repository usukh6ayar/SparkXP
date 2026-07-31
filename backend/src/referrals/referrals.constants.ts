/**
 * Referral reward amounts. Kept in one place so they're easy to tune (and could
 * later move to the admin/DB-configurable limits blob without touching logic).
 */
export const REFERRAL = {
  /** Sparks for the inviter when the invited friend makes their first purchase. */
  FIRST_PURCHASE_SPARKS: 200,
} as const;

// The referral XP amounts moved to `xp/xp-rewards.ts`
// (`referralInviter` / `referralInvitee`) so every XP award is tunable from one
// place at runtime. Sparks stay here — they are a different currency.

/** Prefix + alphabet for generated referral codes (ambiguous chars removed). */
export const REFERRAL_CODE_PREFIX = 'SPARK-';
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const REFERRAL_CODE_LENGTH = 5;
