import { apiRequest } from './client';

/** The current user's referral status — powers the "Invite friends" screen. */
export interface MyReferral {
  /** Short, shareable code (e.g. "SPARK-7K2Q"). */
  referralCode: string;
  /** Username also works as a referral code (backend resolves either). */
  username: string | null;
  /** How many friends have signed up with this user's code. */
  invitedCount: number;
  /** Total XP earned from referrals so far. */
  totalXpEarned: number;
  /** Total Sparks earned from referred friends' first purchases. */
  totalSparksEarned: number;
}

/** GET /referrals/me — the caller's referral code + reward stats. */
export function getMyReferral(token: string): Promise<MyReferral> {
  return apiRequest<MyReferral>('/referrals/me', { token });
}
