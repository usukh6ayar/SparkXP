import { createHmac } from 'crypto';
import { PaymentsService } from './payments.service';
import { AiUsageType, PaymentStatus } from '../common/enums';
import { VoicePacksService } from './voice-packs.service';
import { VoiceCredit } from '../entities/voice-credit.entity';

const SECRET = 'whsec';
const PAY = '11111111-1111-4111-8111-111111111111';
const NOW = Date.now();
const plusPlan = {
  id: 'plan-plus',
  name: 'Plus',
  slug: 'plus',
  priceAmount: 56_000,
  durationDays: 30,
  isActive: true,
};

function setup(env: Record<string, string> = {}) {
  const payments = new Map<string, any>();
  const paymentRepo = {
    create: (d: any) => ({
      id: PAY,
      metadata: null,
      providerRef: null,
      ...d,
    }),
    save: jest.fn(async (p: any) => (payments.set(p.id, p), p)),
    findOne: jest.fn(async ({ where }: any) => payments.get(where.id) ?? null),
  };
  const planRepo = {
    findOne: jest.fn(async (): Promise<any> => plusPlan),
    merge: (p: any, c: any) => ({ ...p, ...c }),
    save: jest.fn(async (p: any) => p),
  };
  const user = { id: 'u-1', planId: null, planExpiresAt: null, plan: null };
  const userRepo = { findOne: jest.fn(async () => user) };
  const promos = {
    quote: jest.fn(async () => ({
      promoId: 'promo-1',
      code: 'AA',
      originalPrice: 56_000,
      finalPrice: 50_400,
    })),
    recordDiscountUse: jest.fn(),
  };
  const referrals = { creditFirstPurchaseBonus: jest.fn() };
  const byl = {
    createCheckout: jest.fn(async (_body: any) => ({
      id: 13338,
      url: 'https://byl.mn/h/checkout/13338/x',
    })),
    getCheckout: jest.fn(async () => ({
      id: 13338,
      status: 'complete',
      amount_total: '56000.00',
      client_reference_id: PAY,
    })),
  };
  const redisKeys = new Set<string>();
  const redis = {
    set: jest.fn(async (k: string) =>
      redisKeys.has(k) ? null : (redisKeys.add(k), 'OK'),
    ),
  };
  const manager = {
    save: jest.fn(async (_e: any, p: any) => p),
    update: jest.fn(),
    findOne: jest.fn(async () => user),
  };
  const dataSource = { transaction: jest.fn(async (fn: any) => fn(manager)) };
  const config = {
    get: (k: string) =>
      ({ BYL_WEBHOOK_SECRET: SECRET, WEB_URL: 'https://web.test', ...env })[k],
  };
  const pack = {
    id: 'pack-10',
    name: '10 минут',
    slug: 'min10',
    priceAmount: 5_000,
    voiceMinutes: 10,
    sttMinutes: 20,
    isActive: true,
  };
  const packRepo = { findOne: jest.fn(async () => pack) };
  const packs = new VoicePacksService(packRepo as any, dataSource as any);
  const svc = new PaymentsService(
    paymentRepo as any,
    planRepo as any,
    userRepo as any,
    referrals as any,
    promos as any,
    dataSource as any,
    byl as any,
    redis as any,
    config as any,
    packs,
  );
  return { svc, payments, byl, promos, referrals, manager, redis, planRepo };
}

const event = (paymentId: string, id = 1) => {
  const raw = Buffer.from(
    JSON.stringify({
      id,
      type: 'checkout.completed',
      data: { object: { id: 13338, client_reference_id: paymentId } },
    }),
  );
  return { raw, sig: createHmac('sha256', SECRET).update(raw).digest('hex') };
};

describe('PaymentsService', () => {
  it('pack: checkout at the pack price, webhook credits the minutes once', async () => {
    const { svc, manager, payments, byl, referrals } = setup();
    const out = await svc.createPackCheckout({ id: 'u-1' } as any, 'pack-10');
    expect(out.paymentId).toBe(PAY);
    const body = byl.createCheckout.mock.calls[0][0];
    expect(body.items[0].price_data.unit_amount).toBe(5_000);
    expect(body.cancel_url).toBe('https://web.test/checkout?pack=min10&canceled=1');

    byl.getCheckout.mockResolvedValue({
      id: 13338,
      status: 'complete',
      amount_total: '5000.00',
      client_reference_id: PAY,
    });
    const { raw, sig } = event(PAY);
    await svc.handleBylWebhook(raw, sig);
    await svc.handleBylWebhook(raw, sig); // Byl retry: no second credit

    expect(payments.get(PAY).status).toBe(PaymentStatus.PAID);
    const credits = manager.save.mock.calls.filter(([e]: any[]) => e === VoiceCredit);
    expect(credits.map(([, row]: any[]) => [row.type, row.seconds])).toEqual([
      [AiUsageType.TTS, 600],
      [AiUsageType.STT, 1200],
    ]);
    // Plans only: a pack never changes the user's plan or pays referral bonuses.
    expect(manager.update).not.toHaveBeenCalled();
    expect(referrals.creditFirstPurchaseBonus).not.toHaveBeenCalled();
  });

  it('updatePlan: changes only the fields sent; null limit = unlimited', async () => {
    const { svc, planRepo } = setup();
    planRepo.findOne.mockResolvedValueOnce({ ...plusPlan, voiceMinutesLimit: 70 });
    const out = await svc.updatePlan('plan-plus', {
      isActive: false,
      voiceMinutesLimit: null,
      priceAmount: undefined,
    });
    expect(out).toMatchObject({
      priceAmount: 56_000,
      isActive: false,
      voiceMinutesLimit: null,
    });
  });

  it('updatePlan: unknown id → 404', async () => {
    const { svc, planRepo } = setup();
    planRepo.findOne.mockResolvedValueOnce(null);
    await expect(svc.updatePlan('nope', { isActive: false })).rejects.toThrow(
      'План олдсонгүй',
    );
  });

  it('quote: list price, promo discount and the resulting expiry', async () => {
    const { svc } = setup();
    const q = await svc.quote({ id: 'u-1' } as any, {
      planId: 'plan-plus',
      promoCode: 'AA',
    });
    expect(q).toMatchObject({
      price: 56_000,
      discount: 5_600,
      finalPrice: 50_400,
      planName: 'Plus',
    });
    expect(new Date(q.accessUntil).getTime()).toBeGreaterThan(
      NOW + 29 * 86_400_000,
    );
  });

  it('createCheckout: pending payment + Byl checkout pointing back to the site', async () => {
    const { svc, payments, byl } = setup();
    const out = await svc.createCheckout({ id: 'u-1' } as any, {
      planId: 'plan-plus',
    });
    expect(out).toEqual({
      paymentId: PAY,
      checkoutUrl: 'https://byl.mn/h/checkout/13338/x',
    });
    const body = byl.createCheckout.mock.calls[0][0];
    expect(body).toMatchObject({
      client_reference_id: PAY,
      email_collection: false,
      success_url: `https://web.test/checkout/success?payment=${PAY}`,
    });
    expect(body.items[0].price_data.unit_amount).toBe(56_000);
    expect(payments.get(PAY)).toMatchObject({
      status: PaymentStatus.PENDING,
      provider: 'byl',
      providerRef: '13338',
      amount: 56_000,
    });
  });

  it('createCheckout with a promo sends the discount to Byl', async () => {
    const { svc, byl } = setup();
    await svc.createCheckout({ id: 'u-1' } as any, {
      planId: 'plan-plus',
      promoCode: 'AA',
    });
    expect(byl.createCheckout.mock.calls[0][0].discounts).toEqual([
      { amount: 5_600, description: 'Промо код AA' },
    ]);
  });

  it('webhook: bad signature → 401, nothing granted', async () => {
    const { svc, manager } = setup();
    const { raw } = event(PAY);
    const err = await svc.handleBylWebhook(raw, 'nope').catch((e) => e);
    expect(err.getStatus()).toBe(401);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('webhook: grants the plan once, records promo + referral', async () => {
    const { svc, manager, promos, referrals, payments, byl } = setup();
    await svc.createCheckout({ id: 'u-1' } as any, {
      planId: 'plan-plus',
      promoCode: 'AA',
    });
    byl.getCheckout.mockResolvedValue({
      id: 13338,
      status: 'complete',
      amount_total: '50400.00',
      client_reference_id: PAY,
    });
    const { raw, sig } = event(PAY);
    await svc.handleBylWebhook(raw, sig);
    expect(payments.get(PAY).status).toBe(PaymentStatus.PAID);
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'u-1' },
      expect.objectContaining({ planId: 'plan-plus' }),
    );
    expect(promos.recordDiscountUse).toHaveBeenCalledWith(
      manager,
      'promo-1',
      'u-1',
      PAY,
    );
    expect(referrals.creditFirstPurchaseBonus).toHaveBeenCalledWith(
      manager,
      'u-1',
    );
  });

  it('webhook: the same event twice grants once', async () => {
    const { svc, manager } = setup();
    await svc.createCheckout({ id: 'u-1' } as any, { planId: 'plan-plus' });
    const { raw, sig } = event(PAY, 9);
    await svc.handleBylWebhook(raw, sig);
    await svc.handleBylWebhook(raw, sig);
    expect(manager.update).toHaveBeenCalledTimes(1);
  });

  it('webhook: a different event id for an already-paid payment does nothing', async () => {
    const { svc, manager } = setup();
    await svc.createCheckout({ id: 'u-1' } as any, { planId: 'plan-plus' });
    await svc.handleBylWebhook(event(PAY, 1).raw, event(PAY, 1).sig);
    await svc.handleBylWebhook(event(PAY, 2).raw, event(PAY, 2).sig);
    expect(manager.update).toHaveBeenCalledTimes(1);
  });

  it('webhook (live): amount mismatch → no grant, flagged', async () => {
    const { svc, manager, byl, payments } = setup();
    await svc.createCheckout({ id: 'u-1' } as any, { planId: 'plan-plus' });
    byl.getCheckout.mockResolvedValue({
      id: 13338,
      status: 'complete',
      amount_total: '100.00',
      client_reference_id: PAY,
    });
    await svc.handleBylWebhook(event(PAY).raw, event(PAY).sig);
    expect(manager.update).not.toHaveBeenCalled();
    expect(payments.get(PAY).metadata.mismatch).toBe(true);
  });

  it('webhook (BYL_TEST_MODE): Byl test checkouts are always 100₮ — still grants', async () => {
    const { svc, manager, byl } = setup({ BYL_TEST_MODE: 'true' });
    await svc.createCheckout({ id: 'u-1' } as any, { planId: 'plan-plus' });
    byl.getCheckout.mockResolvedValue({
      id: 13338,
      status: 'complete',
      amount_total: '100.00',
      client_reference_id: PAY,
    });
    await svc.handleBylWebhook(event(PAY).raw, event(PAY).sig);
    expect(manager.update).toHaveBeenCalledTimes(1);
  });

  it('webhook: checkout not complete at Byl → no grant', async () => {
    const { svc, manager, byl } = setup();
    await svc.createCheckout({ id: 'u-1' } as any, { planId: 'plan-plus' });
    byl.getCheckout.mockResolvedValue({
      id: 13338,
      status: 'open',
      amount_total: '56000',
      client_reference_id: PAY,
    });
    await svc.handleBylWebhook(event(PAY).raw, event(PAY).sig);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('webhook: a non-UUID reference is ignored with 2xx, not a crash', async () => {
    const { svc, manager } = setup();
    const { raw, sig } = event('not-a-uuid');
    await expect(svc.handleBylWebhook(raw, sig)).resolves.toBeUndefined();
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('webhook: ignores other event types and unknown payments', async () => {
    const { svc, manager } = setup();
    const raw = Buffer.from(
      JSON.stringify({ id: 5, type: 'invoice.paid', data: { object: {} } }),
    );
    await svc.handleBylWebhook(
      raw,
      createHmac('sha256', SECRET).update(raw).digest('hex'),
    );
    await svc.handleBylWebhook(event('missing').raw, event('missing').sig);
    expect(manager.update).not.toHaveBeenCalled();
  });
});
