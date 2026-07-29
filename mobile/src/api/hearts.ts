import { apiRequest } from './client';

/**
 * Duolingo-style "hearts" (lives). Mirrors the backend `HeartsState`
 * (`backend/src/hearts/hearts.service.ts`, documented in API.md §6a).
 *
 * The server is the ONLY source of truth — never count hearts locally. A wrong
 * answer is charged inside `POST /quizzes/:id/check` (there is deliberately no
 * "lose a heart" endpoint), so the check response already carries a fresh
 * `HeartsState`. Regeneration is lazy on the server, so a stored count is
 * meaningless without going through this API.
 */
export interface HeartsState {
  /** Hearts available right now (regeneration already folded in). */
  hearts: number;
  /** Cap for this user's plan. */
  max: number;
  /** True on premium plans — hearts never decrement and the UI hides them. */
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
