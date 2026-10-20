import { DictionaryService } from '../dictionary/dictionary.service';
import { FREE_PLAN_SLUG, planInForce, resolvePlan } from './plan-in-force';

/** Which plan's limits apply — the rule that stops free users getting a paid tier. */
type Caps = { slug: string; dictionaryAiLimit: number | null };
const FREE: Caps = { slug: 'free', dictionaryAiLimit: 30 };
const PLUS: Caps = { slug: 'plus', dictionaryAiLimit: null };
const NOW = Date.parse('2026-10-20T00:00:00Z');

describe('planInForce', () => {
  it('uses the active plan', () => {
    const user = { plan: PLUS, planExpiresAt: new Date(NOW + 1000) };
    expect(planInForce(user, FREE, NOW)).toBe(PLUS);
  });

  it('uses a plan with no expiry', () => {
    expect(planInForce({ plan: PLUS, planExpiresAt: null }, FREE, NOW)).toBe(
      PLUS,
    );
  });

  it('gives a user with no plan the Free limits', () => {
    expect(planInForce({ plan: null, planExpiresAt: null }, FREE, NOW)).toBe(
      FREE,
    );
  });

  it('gives a user whose plan expired the Free limits', () => {
    const user = { plan: PLUS, planExpiresAt: new Date(NOW - 1000) };
    expect(planInForce(user, FREE, NOW)).toBe(FREE);
  });

  it('treats an unloaded plan relation as no plan', () => {
    const user = { plan: undefined as never, planExpiresAt: null };
    expect(planInForce(user, FREE, NOW)).toBe(FREE);
  });
});

describe('resolvePlan', () => {
  it('reads the Free row only when the user has no active plan', async () => {
    const plans = { findOne: jest.fn().mockResolvedValue(FREE) };
    const active = { plan: PLUS, planExpiresAt: null } as never;
    expect(await resolvePlan(active, plans as never)).toBe(PLUS);
    expect(plans.findOne).not.toHaveBeenCalled();

    const free = { plan: null, planExpiresAt: null } as never;
    expect(await resolvePlan(free, plans as never)).toBe(FREE);
    expect(plans.findOne).toHaveBeenCalledWith({
      where: { slug: FREE_PLAN_SLUG },
    });
  });
});

describe('DictionaryService.assertAiQuota', () => {
  const service = (freeRow: unknown) =>
    new DictionaryService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue(freeRow) } as never,
    );
  const user = (count: number, plan: unknown = null) =>
    ({ plan, planExpiresAt: null, dictionaryAiCount: count }) as never;

  it('blocks a free user at the Free cap', async () => {
    await expect(
      service(FREE).assertAiQuota(user(29)),
    ).resolves.toBeUndefined();
    await expect(service(FREE).assertAiQuota(user(30))).rejects.toThrow(
      '30 тайлбар/сар',
    );
  });

  it('lets an unlimited paid plan through', async () => {
    await expect(
      service(FREE).assertAiQuota(user(999, PLUS)),
    ).resolves.toBeUndefined();
  });

  it('does not lock anyone out when the Free row is missing', async () => {
    await expect(
      service(null).assertAiQuota(user(999)),
    ).resolves.toBeUndefined();
  });
});
