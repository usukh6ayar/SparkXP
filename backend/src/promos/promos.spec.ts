import { accessUntil, discountedPrice } from './promos.service';

/**
 * The two promo rules that decide money and access. Pure functions, so every
 * branch is covered without a database; the race on the last use is covered
 * against real Postgres in test/promos.e2e-spec.ts.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-01T00:00:00Z');

describe('accessUntil', () => {
  it('starts a fresh grant from now when there is no active plan', () => {
    const until = accessUntil(
      { planId: null, planExpiresAt: null },
      'plus',
      7,
      NOW,
    );
    expect(until!.getTime()).toBe(NOW.getTime() + 7 * DAY);
  });

  it('treats an expired plan as no plan', () => {
    const expired = new Date(NOW.getTime() - DAY);
    const until = accessUntil(
      { planId: 'essential', planExpiresAt: expired },
      'plus',
      7,
      NOW,
    );
    expect(until!.getTime()).toBe(NOW.getTime() + 7 * DAY);
  });

  it('extends the SAME active plan from its current expiry', () => {
    const ends = new Date(NOW.getTime() + 3 * DAY);
    const until = accessUntil(
      { planId: 'plus', planExpiresAt: ends },
      'plus',
      7,
      NOW,
    );
    expect(until!.getTime()).toBe(ends.getTime() + 7 * DAY);
  });

  it('refuses when a DIFFERENT plan is active — a promo never swaps a paid plan', () => {
    const ends = new Date(NOW.getTime() + 20 * DAY);
    expect(
      accessUntil({ planId: 'plus', planExpiresAt: ends }, 'essential', 7, NOW),
    ).toBeNull();
  });

  it('refuses when the active plan never expires', () => {
    expect(
      accessUntil({ planId: 'plus', planExpiresAt: null }, 'plus', 7, NOW),
    ).toBeNull();
  });
});

describe('discountedPrice', () => {
  it('takes a percentage off, rounded to whole tögrög', () => {
    expect(
      discountedPrice(34000, { kind: 'discount_percent', value: 15 }),
    ).toBe(28900);
  });

  it('takes a fixed amount off and never goes below zero', () => {
    expect(
      discountedPrice(34000, { kind: 'discount_fixed', value: 5000 }),
    ).toBe(29000);
    expect(discountedPrice(3000, { kind: 'discount_fixed', value: 5000 })).toBe(
      0,
    );
  });

  it('leaves the price alone for a free-access code', () => {
    expect(discountedPrice(34000, { kind: 'free_access', value: 7 })).toBe(
      34000,
    );
  });
});
