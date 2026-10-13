const DAY_MS = 86_400_000;

export interface CurrentPlan {
  planId: string | null;
  planExpiresAt: Date | null;
  /** List price of the current plan (0 when none). */
  planPrice: number;
}

export interface PurchasedPlan {
  planId: string;
  price: number;
  durationDays: number;
}

/**
 * New plan expiry after a purchase, or null when it must be refused
 * (an active plan with no expiry — admin-granted unlimited access).
 *
 * - no / expired plan → now + duration
 * - same plan        → max(now, expiry) + duration
 * - other plan       → now + duration + remaining days converted by LIST price
 *   (money already paid is never lost; spec decision 2)
 */
export function planAccessAfterPurchase(
  current: CurrentPlan,
  bought: PurchasedPlan,
  now = new Date(),
): Date | null {
  const active =
    current.planId !== null &&
    (current.planExpiresAt === null ||
      current.planExpiresAt.getTime() > now.getTime());
  const base = now.getTime() + bought.durationDays * DAY_MS;
  if (!active) return new Date(base);
  if (current.planExpiresAt === null) return null;

  const remainingMs = current.planExpiresAt.getTime() - now.getTime();
  if (current.planId === bought.planId) return new Date(remainingMs + base);

  const bonusDays = Math.floor(
    ((remainingMs / DAY_MS) * current.planPrice) / bought.price,
  );
  return new Date(base + bonusDays * DAY_MS);
}
