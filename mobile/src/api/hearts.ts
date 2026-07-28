import { apiRequest } from './client';

/**
 * Duolingo-style "hearts" (lives). The server is the ONLY source of truth —
 * never count locally. A wrong answer is charged inside `POST /quizzes/:id/check`
 * (see API.md §6a), so the check response carries a fresh `HeartsState`; this
 * client is for reading the current state and for spending Sparks to refill.
 */
export interface HeartsState {
  /** Hearts left right now (server already added any lazy regen). */
  hearts: number;
  /** Max hearts for the user's plan. */
  max: number;
  /** Premium: hearts are never spent — the UI hides them entirely. */
  unlimited: boolean;
  /** ISO time the next heart regenerates (null when full / unlimited). */
  nextHeartAt: string | null;
  /** ISO time hearts are fully restored (null when full / unlimited). */
  fullAt: string | null;
  /** Sparks it costs to refill to full right now (null when already full). */
  refillCost: number | null;
}

/** Current hearts, regen accounted for. */
export function getHearts(token: string): Promise<HeartsState> {
  return apiRequest<HeartsState>('/hearts', { token });
}

/** Spend Sparks to refill to full. 400 if already full or Sparks are short. */
export function refillHearts(token: string): Promise<HeartsState> {
  return apiRequest<HeartsState>('/hearts/refill', { method: 'POST', token });
}
