import { apiRequest } from './client';

/** One shop row with the current user's state. Mirrors the backend `BackgroundView`. */
export interface BackgroundView {
  id: string;
  name: string;
  imageUrl: string;
  priceSparks: number;
  isPremium: boolean;
  seasonal: boolean;
  owned: boolean;
  equipped: boolean;
  /** Buyable right now (active · in season · premium ok · not owned). */
  purchasable: boolean;
  /** Premium-only and the user has no active plan. */
  premiumLocked: boolean;
}

/** The equipped background shown behind the buddy (null when none). */
export interface EquippedBackground {
  id: string;
  name: string;
  imageUrl: string;
}

/** GET /buddy/backgrounds — shop catalog with owned/equipped/lock state. */
export function getBackgrounds(token: string): Promise<BackgroundView[]> {
  return apiRequest<BackgroundView[]>('/buddy/backgrounds', { token });
}

/** GET /buddy/backgrounds/equipped — the user's current background, or null. */
export function getEquippedBackground(token: string): Promise<EquippedBackground | null> {
  return apiRequest<EquippedBackground | null>('/buddy/backgrounds/equipped', { token });
}

/** POST /buddy/backgrounds/:id/buy — spend Sparks. Throws ApiError 400 when
 *  short on Sparks / already owned / out of season (message is Mongolian). */
export function buyBackground(
  id: string,
  token: string,
): Promise<{ owned: true; equipped: boolean; sparksSpent: number }> {
  return apiRequest(`/buddy/backgrounds/${id}/buy`, { method: 'POST', token });
}

/** POST /buddy/backgrounds/:id/equip — equip an owned background. */
export function equipBackground(id: string, token: string): Promise<{ equipped: string }> {
  return apiRequest(`/buddy/backgrounds/${id}/equip`, { method: 'POST', token });
}
