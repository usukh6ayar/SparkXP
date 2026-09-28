import { apiRequest } from './client';

/** What a redeemed free-access promo code gave the user. */
export interface PromoRedeemResult {
  code: string;
  planId: string | null;
  planName: string | null;
  days: number;
  /** ISO — when the granted plan access ends. */
  accessUntil: string;
}

/** POST /promos/redeem — the «Промо код» screen. */
export function redeemPromo(code: string, token: string): Promise<PromoRedeemResult> {
  return apiRequest<PromoRedeemResult>('/promos/redeem', {
    method: 'POST',
    body: { code: code.trim() },
    token,
  });
}
