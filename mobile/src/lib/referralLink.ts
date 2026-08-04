/**
 * Single source of truth for the referral (invite) deep link — the twin of
 * `joinLink.ts`, but for inviting friends instead of joining a class.
 *
 * Format: `sparkxp://invite/<CODE>` (scheme = app.json "scheme"). The <CODE>
 * is either a user's short referral code (e.g. `SPARK-7K2Q`) or their username —
 * the backend resolves either, case-insensitively, to the inviter.
 *
 * When a logged-out user opens an invite link we can't consume it yet (they
 * aren't registered), so the code is stashed in secure storage and picked up by
 * the register screen.
 */
import * as SecureStore from 'expo-secure-store';

const INVITE_PREFIX = 'sparkxp://invite/';

/** Key for the referral code captured from a deep link before registration. */
const PENDING_REFERRAL_KEY = 'sparkxp.pendingReferral';

/** The value to encode in a user's invite QR code / share link. */
export function buildInviteLink(code: string): string {
  return INVITE_PREFIX + code.trim();
}

/**
 * Extract a referral code from a scanned/opened value. Accepts the full deep
 * link or a bare code/username, so it's forgiving of either. Case is preserved
 * (the backend matches case-insensitively). Returns null if it doesn't look
 * like a code.
 */
export function parseInviteCode(value: string): string | null {
  const raw = value.trim();
  const code = raw.startsWith(INVITE_PREFIX) ? raw.slice(INVITE_PREFIX.length) : raw;
  // Usernames (3–30, letters/digits/_) or short codes (e.g. SPARK-7K2Q).
  return /^[A-Za-z0-9_-]{3,40}$/.test(code) ? code : null;
}

/** Remember a referral code from a deep link until the user registers. */
export function stashPendingReferral(code: string): Promise<void> {
  return SecureStore.setItemAsync(PENDING_REFERRAL_KEY, code);
}

/** Read the stashed referral code without consuming it (register prefill). */
export function peekPendingReferral(): Promise<string | null> {
  return SecureStore.getItemAsync(PENDING_REFERRAL_KEY);
}

/** Clear the stashed referral code once it's been applied at registration. */
export function clearPendingReferral(): Promise<void> {
  return SecureStore.deleteItemAsync(PENDING_REFERRAL_KEY);
}
