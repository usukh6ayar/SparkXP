import { apiRequest } from './client';

/**
 * Quiz "lives". Mirrors the backend `HeartsState`
 * (`backend/src/hearts/hearts.service.ts`).
 *
 * Hearts are ONLY ever spent server-side, inside `POST /quizzes/:id/check` —
 * there is deliberately no "lose a heart" endpoint. So the client never
 * decrements anything itself: it renders whatever the server last returned.
 * Regeneration is lazy (no cron), which is why the stored count is meaningless
 * without going through this API.
 */
export interface HeartsState {
  /** Hearts available right now (regeneration already folded in). */
  hearts: number;
  /** Cap for this user's plan. */
  max: number;
  /** True on premium plans — hearts are cosmetic and never decrement. */
  unlimited: boolean;
  /** ISO time the NEXT heart regenerates; null when full or unlimited. */
  nextHeartAt: string | null;
  /** ISO time hearts are back to full; null when full or unlimited. */
  fullAt: string | null;
  /** Sparks needed to refill right now; null when full or unlimited. */
  refillCost: number | null;
}

/** GET /hearts — current state, with elapsed regeneration applied. */
export function getHearts(token: string): Promise<HeartsState> {
  return apiRequest<HeartsState>('/hearts', { token });
}

/**
 * POST /hearts/refill — spend Sparks to fill back up.
 * Throws `ApiError` 400 when already full or short on Sparks (the backend
 * message is already Mongolian, so callers can show it as-is).
 */
export function refillHearts(token: string): Promise<HeartsState> {
  return apiRequest<HeartsState>('/hearts/refill', { method: 'POST', token });
}
