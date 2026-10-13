import { planAccessAfterPurchase } from './plan-access';

const DAY = 86_400_000;
const NOW = new Date('2026-10-14T00:00:00Z');
const plus = { planId: 'plus', price: 56_000, durationDays: 30 };

describe('planAccessAfterPurchase', () => {
  it('no plan → now + 30 days', () => {
    const r = planAccessAfterPurchase(
      { planId: null, planExpiresAt: null, planPrice: 0 },
      plus,
      NOW,
    );
    expect(r!.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it('expired plan counts as no plan', () => {
    const r = planAccessAfterPurchase(
      {
        planId: 'standard',
        planExpiresAt: new Date(NOW.getTime() - DAY),
        planPrice: 34_000,
      },
      plus,
      NOW,
    );
    expect(r!.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it('same plan extends from the current expiry', () => {
    const ends = new Date(NOW.getTime() + 5 * DAY);
    const r = planAccessAfterPurchase(
      { planId: 'plus', planExpiresAt: ends, planPrice: 56_000 },
      plus,
      NOW,
    );
    expect(r!.getTime()).toBe(ends.getTime() + 30 * DAY);
  });

  it('upgrade converts the remaining days by list price (10 × 34k / 56k → +6)', () => {
    const ends = new Date(NOW.getTime() + 10 * DAY);
    const r = planAccessAfterPurchase(
      { planId: 'standard', planExpiresAt: ends, planPrice: 34_000 },
      plus,
      NOW,
    );
    expect(r!.getTime()).toBe(NOW.getTime() + 36 * DAY);
  });

  it('downgrade converts the other way (10 × 56k / 34k → +16)', () => {
    const ends = new Date(NOW.getTime() + 10 * DAY);
    const r = planAccessAfterPurchase(
      { planId: 'plus', planExpiresAt: ends, planPrice: 56_000 },
      { planId: 'standard', price: 34_000, durationDays: 30 },
      NOW,
    );
    expect(r!.getTime()).toBe(NOW.getTime() + 46 * DAY);
  });

  it('an active plan with no expiry blocks a switch (null)', () => {
    expect(
      planAccessAfterPurchase(
        { planId: 'premier', planExpiresAt: null, planPrice: 85_000 },
        plus,
        NOW,
      ),
    ).toBeNull();
  });

  it('an active plan with no expiry, same plan, also null (nothing to extend)', () => {
    expect(
      planAccessAfterPurchase(
        { planId: 'plus', planExpiresAt: null, planPrice: 56_000 },
        plus,
        NOW,
      ),
    ).toBeNull();
  });
});
