/** Shapes + labels shared by the promo page and its modals. */

export type PromoKind = 'free_access' | 'discount_percent' | 'discount_fixed';

export interface Plan {
  id: string;
  name: string;
  priceAmount: number;
}

export interface Promo {
  id: string;
  name: string;
  code: string;
  kind: PromoKind;
  value: number;
  planId: string | null;
  plan: { id: string; name: string } | null;
  validFrom: string | null;
  validUntil: string | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  audience: 'general' | 'influencer';
  assignedUser: { id: string; email: string; fullName: string } | null;
  note: string | null;
  createdAt: string;
}

export interface Redemption {
  id: string;
  createdAt: string;
  accessUntil: string | null;
  paymentId: string | null;
  user: { id: string; email: string; fullName: string };
}

export const KIND_OPTIONS: { value: PromoKind; label: string }[] = [
  { value: 'free_access', label: 'Үнэгүй эрх (хоног)' },
  { value: 'discount_percent', label: 'Хөнгөлөлт (%)' },
  { value: 'discount_fixed', label: 'Хөнгөлөлт (₮)' },
];

/** "7 хоног" · "15%" · "5,000₮" */
export function valueLabel(p: Pick<Promo, 'kind' | 'value'>): string {
  if (p.kind === 'free_access') return `${p.value} хоног`;
  if (p.kind === 'discount_percent') return `${p.value}%`;
  return `${p.value.toLocaleString()}₮`;
}

/** Active, and inside its dates, and uses left. */
export function isLive(p: Promo, now = Date.now()): boolean {
  if (!p.isActive) return false;
  if (p.validFrom && new Date(p.validFrom).getTime() > now) return false;
  if (p.validUntil && new Date(p.validUntil).getTime() < now) return false;
  return p.usageLimit === null || p.usedCount < p.usageLimit;
}

/** <input type="date"> value → ISO at local end of day (a "valid until" day counts). */
export function endOfDayIso(date: string): string | undefined {
  return date ? new Date(`${date}T23:59:59`).toISOString() : undefined;
}
