# Byl Web Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sell the three 30-day plans on the marketing website through Byl Checkout, grant them from a signature-verified webhook, and remove the client-callable `confirm` hole.

**Spec:** `docs/superpowers/specs/2026-10-14-byl-web-payments-design.md`

**Architecture:** `POST /payments` prices the plan on the server (promo via `PromosService.quote`), stores a `pending` Payment and opens a Byl checkout whose `client_reference_id` is our payment id. Byl redirects the buyer back to the website; the **only** thing that grants access is `POST /payments/webhook/byl`, which verifies `Byl-Signature` (HMAC-SHA256 over the raw body), re-reads the checkout from Byl, and grants inside one transaction. A pure `planAccessAfterPurchase()` decides the new expiry.

**Tech Stack:** NestJS + TypeORM + ioredis (backend) · Next.js 16 app router + Tailwind 4 (`SparkXP_web`, separate repo) · Vite/React (admin) · Expo (mobile) · Jest.

**Branches:** SparkXP work on `usukhbayar`; `SparkXP_web` work on a `feature/web-checkout` branch in that repo. Ask before `gh pr create`.

---

## File map

**Backend — create**
- `backend/src/payments/plan-access.ts` (+ `plan-access.spec.ts`)
- `backend/src/payments/byl/byl-signature.ts` (+ spec)
- `backend/src/payments/byl/byl.client.ts` (+ spec)
- `backend/src/payments/payments-errors.ts`
- `backend/src/payments/payments.service.spec.ts`
- `backend/src/migrations/1788300000000-PlansMatchClientBrief.ts`

**Backend — modify**
- `backend/src/payments/payments.service.ts` (rewrite the money path)
- `backend/src/payments/payments.controller.ts` (new routes, remove `confirm`)
- `backend/src/payments/dto/create-payment.dto.ts` (plans only) · delete `dto/confirm-payment.dto.ts`
- `backend/src/payments/payments.module.ts`
- `backend/src/main.ts` (raw body for the webhook, `WEB_ORIGIN` CORS)
- `backend/src/payments/guards/payments-enabled.guard.ts` (doc comment only)
- `backend/.env.example`, `API.md`

**Web (`SparkXP_web`) — create:** `src/lib/api.ts`, `src/lib/session.ts`, `src/app/login/page.tsx`, `src/app/checkout/page.tsx`, `src/app/checkout/success/page.tsx`, `src/components/auth-shell.tsx`
**Web — modify:** `src/lib/i18n.ts`, `src/components/pricing.tsx`, `.env.example` (create if missing)

**Admin — modify:** `admin/src/pages/monitor/MonitorPage.tsx`

**Mobile — modify:** `mobile/app/plan.tsx`

---

# PART B — Backend

### Task B1: `planAccessAfterPurchase`

**Files:** Create `backend/src/payments/plan-access.ts`, Test `backend/src/payments/plan-access.spec.ts`

- [ ] **Step 1: Failing test**

```ts
// backend/src/payments/plan-access.spec.ts
import { planAccessAfterPurchase } from './plan-access';

const DAY = 86_400_000;
const NOW = new Date('2026-10-14T00:00:00Z');
const plus = { planId: 'plus', price: 56_000, durationDays: 30 };

describe('planAccessAfterPurchase', () => {
  it('no plan → now + 30 days', () => {
    const r = planAccessAfterPurchase({ planId: null, planExpiresAt: null, planPrice: 0 }, plus, NOW);
    expect(r!.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it('expired plan counts as no plan', () => {
    const r = planAccessAfterPurchase(
      { planId: 'standard', planExpiresAt: new Date(NOW.getTime() - DAY), planPrice: 34_000 },
      plus,
      NOW,
    );
    expect(r!.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it('same plan extends from the current expiry', () => {
    const ends = new Date(NOW.getTime() + 5 * DAY);
    const r = planAccessAfterPurchase({ planId: 'plus', planExpiresAt: ends, planPrice: 56_000 }, plus, NOW);
    expect(r!.getTime()).toBe(ends.getTime() + 30 * DAY);
  });

  it('upgrade converts the remaining days by list price (10 × 34k / 56k → +6)', () => {
    const ends = new Date(NOW.getTime() + 10 * DAY);
    const r = planAccessAfterPurchase({ planId: 'standard', planExpiresAt: ends, planPrice: 34_000 }, plus, NOW);
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
    expect(planAccessAfterPurchase({ planId: 'premier', planExpiresAt: null, planPrice: 85_000 }, plus, NOW)).toBeNull();
  });

  it('an active plan with no expiry, same plan, also null (nothing to extend)', () => {
    expect(planAccessAfterPurchase({ planId: 'plus', planExpiresAt: null, planPrice: 56_000 }, plus, NOW)).toBeNull();
  });
});
```

- [ ] **Step 2:** `cd backend && npx jest src/payments/plan-access.spec.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// backend/src/payments/plan-access.ts
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
export function planAccessAfterPurchase(current: CurrentPlan, bought: PurchasedPlan, now = new Date()): Date | null {
  const active =
    current.planId !== null && (current.planExpiresAt === null || current.planExpiresAt.getTime() > now.getTime());
  const base = now.getTime() + bought.durationDays * DAY_MS;
  if (!active) return new Date(base);
  if (current.planExpiresAt === null) return null;

  const remainingMs = current.planExpiresAt.getTime() - now.getTime();
  if (current.planId === bought.planId) return new Date(remainingMs + base);

  const bonusDays = Math.floor(((remainingMs / DAY_MS) * current.planPrice) / bought.price);
  return new Date(base + bonusDays * DAY_MS);
}
```

- [ ] **Step 4:** run the test → PASS (7).
- [ ] **Step 5:** `git add backend/src/payments/plan-access* && git commit -m "feat(payments): багцын хугацаа тооцох (сунгах / шилжүүлэх)"`

---

### Task B2: Byl signature

**Files:** Create `backend/src/payments/byl/byl-signature.ts`, Test `byl-signature.spec.ts`

- [ ] **Step 1: Failing test**

```ts
// backend/src/payments/byl/byl-signature.spec.ts
import { createHmac } from 'crypto';
import { verifyBylSignature } from './byl-signature';

const secret = 'whsec_test';
const body = Buffer.from('{"id":3,"type":"checkout.completed","data":{"object":{"id":71}}}');
const sign = (b: Buffer) => createHmac('sha256', secret).update(b).digest('hex');

describe('verifyBylSignature', () => {
  it('accepts the HMAC of the exact raw body', () => {
    expect(verifyBylSignature(body, sign(body), secret)).toBe(true);
  });

  it('rejects a wrong signature', () => {
    expect(verifyBylSignature(body, sign(Buffer.from('x')), secret)).toBe(false);
  });

  it('rejects a re-serialised body (why the RAW body is required)', () => {
    const reserialised = Buffer.from(JSON.stringify(JSON.parse(body.toString()), null, 1));
    expect(verifyBylSignature(reserialised, sign(body), secret)).toBe(false);
  });

  it.each([
    ['no body', undefined, 'abc', secret],
    ['no header', body, undefined, secret],
    ['no secret', body, sign(body), undefined],
    ['length mismatch', body, 'abc', secret],
  ])('rejects %s', (_l, b, h, s) => {
    expect(verifyBylSignature(b as Buffer | undefined, h as string | undefined, s as string | undefined)).toBe(false);
  });
});
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement**

```ts
// backend/src/payments/byl/byl-signature.ts
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Byl signs every webhook: `Byl-Signature = hex(HMAC-SHA256(secret, raw body))`.
 * Must be computed over the bytes exactly as received — parsing and
 * re-stringifying changes key order/spacing and the signature stops matching.
 * Constant-time compare; anything missing → false (fail closed).
 */
export function verifyBylSignature(
  rawBody: Buffer | undefined,
  header: string | undefined,
  secret: string | undefined,
): boolean {
  if (!rawBody || !header || !secret) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'));
  const given = Buffer.from(header.trim());
  return expected.length === given.length && timingSafeEqual(expected, given);
}
```

- [ ] **Step 4:** run → PASS. **Step 5:** commit `feat(payments): Byl webhook гарын үсэг шалгах`.

---

### Task B3: Error helper + Byl client

**Files:** Create `backend/src/payments/payments-errors.ts`, `backend/src/payments/byl/byl.client.ts`, Test `byl.client.spec.ts`

- [ ] **Step 1: Errors**

```ts
// backend/src/payments/payments-errors.ts
import { HttpException, HttpStatus } from '@nestjs/common';

/** Error with a machine `code` — the website/app match the code, not the Mongolian message. */
export function paymentError(status: HttpStatus, code: string, message: string): HttpException {
  return new HttpException({ statusCode: status, code, message }, status);
}

export const paymentUnavailable = () =>
  paymentError(HttpStatus.SERVICE_UNAVAILABLE, 'PAYMENT_UNAVAILABLE', 'Төлбөрийн систем түр ажиллахгүй байна. Түр хүлээгээд дахин оролдоно уу.');
```

- [ ] **Step 2: Failing client test**

```ts
// backend/src/payments/byl/byl.client.spec.ts
import type { ConfigService } from '@nestjs/config';
import { BylClient } from './byl.client';

const config = (env: Record<string, string | undefined>) => ({ get: (k: string) => env[k] }) as unknown as ConfigService;
const res = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body }) as Response;
const live = () => new BylClient(config({ BYL_API_TOKEN: 'tok', BYL_PROJECT_ID: '7' }));

describe('BylClient', () => {
  const realFetch = global.fetch;
  afterEach(() => (global.fetch = realFetch));

  it('creates a checkout on the project with the bearer token', async () => {
    const f = jest.fn().mockResolvedValue(res(201, { data: { id: 13338, url: 'https://byl.mn/h/checkout/13338/x' } }));
    global.fetch = f;
    const out = await live().createCheckout({ items: [], client_reference_id: 'p1' });
    expect(out).toEqual({ id: 13338, url: 'https://byl.mn/h/checkout/13338/x' });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://byl.mn/api/v1/projects/7/checkouts');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.headers.Accept).toBe('application/json');
  });

  it('reads a checkout', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      res(200, { data: { id: 1, status: 'complete', amount_total: '56000.000000', client_reference_id: 'p1' } }),
    );
    await expect(live().getCheckout(1)).resolves.toMatchObject({ status: 'complete', amount_total: '56000.000000' });
  });

  it.each([422, 503, 500])('maps %i to 503 PAYMENT_UNAVAILABLE', async (s) => {
    global.fetch = jest.fn().mockResolvedValue(res(s, { error: 'missing_bank_account' }));
    const err = await live().createCheckout({ items: [] }).catch((e) => e);
    expect(err.getStatus()).toBe(503);
    expect(err.getResponse()).toMatchObject({ code: 'PAYMENT_UNAVAILABLE' });
  });

  it('maps a network error to 503', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));
    expect((await live().getCheckout(1).catch((e) => e)).getStatus()).toBe(503);
  });

  it('refuses without token/project (fail closed, no network)', async () => {
    const f = jest.fn();
    global.fetch = f;
    const err = await new BylClient(config({})).createCheckout({ items: [] }).catch((e) => e);
    expect(err.getStatus()).toBe(503);
    expect(f).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3:** run → FAIL.
- [ ] **Step 4: Implement**

```ts
// backend/src/payments/byl/byl.client.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { paymentUnavailable } from '../payments-errors';

/** https://byl.mn/docs — REST, JSON, Bearer token, one project per id. */
const BASE = 'https://byl.mn/api/v1';
const TIMEOUT_MS = 10_000;

export interface BylCheckoutStatus {
  id: number;
  status: 'open' | 'pending' | 'complete' | 'expired';
  /** Decimal as a STRING on checkouts, e.g. "56000.000000000000". */
  amount_total: string;
  client_reference_id: string | null;
}

@Injectable()
export class BylClient implements OnModuleInit {
  private readonly logger = new Logger(BylClient.name);

  constructor(private readonly config: ConfigService) {}

  private get token() { return this.config.get<string>('BYL_API_TOKEN') ?? ''; }
  private get projectId() { return this.config.get<string>('BYL_PROJECT_ID') ?? ''; }

  onModuleInit(): void {
    if (!this.token || !this.projectId) this.logger.warn('BYL_API_TOKEN / BYL_PROJECT_ID not set — checkout answers 503');
  }

  /** POST /projects/:id/checkouts → { id, url }. `body` is Byl's checkout shape. */
  async createCheckout(body: Record<string, unknown>): Promise<{ id: number; url: string }> {
    const data = await this.call<{ id: number; url: string }>('/checkouts', { method: 'POST', body: JSON.stringify(body) });
    return { id: data.id, url: data.url };
  }

  async getCheckout(id: number | string): Promise<BylCheckoutStatus> {
    return this.call<BylCheckoutStatus>(`/checkouts/${encodeURIComponent(String(id))}`, { method: 'GET' });
  }

  private async call<T>(path: string, init: RequestInit): Promise<T> {
    if (!this.token || !this.projectId) throw paymentUnavailable();
    let res: Response;
    try {
      res = await fetch(`${BASE}/projects/${this.projectId}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json', // without it Byl answers errors as HTML
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.warn(`Byl unreachable: ${err instanceof Error ? err.message : String(err)}`);
      throw paymentUnavailable();
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      // 503 = project misconfigured (no bank account, no Byl plan…) — the owner must act.
      this.logger.error(`Byl ${init.method} ${path} → ${res.status} ${JSON.stringify(body)}`);
      throw paymentUnavailable();
    }
    return ((await res.json()) as { data: T }).data;
  }
}
```

- [ ] **Step 5:** run → PASS. **Step 6:** commit `feat(payments): Byl client (checkout үүсгэх / унших)`.

---

### Task B4: Payments service — quote, checkout, webhook

**Files:** Modify `backend/src/payments/payments.service.ts`, `backend/src/payments/dto/create-payment.dto.ts`; delete `dto/confirm-payment.dto.ts`; Test `backend/src/payments/payments.service.spec.ts`

- [ ] **Step 1: DTOs** — replace `create-payment.dto.ts` with:

```ts
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** POST /payments and GET /payments/quote — plans only (Sparks packs come later). */
export class CreatePaymentDto {
  @IsUUID()
  planId: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  promoCode?: string;
}
```

Run `grep -rn "SPARKS_PACKAGES\|ConfirmPaymentDto" backend/src` and remove every remaining reference (only the service/controller use them).

- [ ] **Step 2: Failing service test**

```ts
// backend/src/payments/payments.service.spec.ts
import { createHmac } from 'crypto';
import { PaymentsService } from './payments.service';
import { PaymentStatus } from '../common/enums';

const SECRET = 'whsec';
const NOW = Date.now();
const plusPlan = { id: 'plan-plus', name: 'Plus', slug: 'plus', priceAmount: 56_000, durationDays: 30, isActive: true };

function setup(env: Record<string, string> = {}) {
  const payments = new Map<string, any>();
  const paymentRepo = {
    create: (d: any) => ({ id: 'pay-1', metadata: null, providerRef: null, ...d }),
    save: jest.fn(async (p: any) => (payments.set(p.id, p), p)),
    findOne: jest.fn(async ({ where }: any) => payments.get(where.id) ?? null),
  };
  const planRepo = { findOne: jest.fn(async () => plusPlan) };
  const user = { id: 'u-1', planId: null, planExpiresAt: null, plan: null };
  const userRepo = { findOne: jest.fn(async () => user) };
  const promos = {
    quote: jest.fn(async () => ({ promoId: 'promo-1', code: 'AA', originalPrice: 56_000, finalPrice: 50_400 })),
    recordDiscountUse: jest.fn(),
  };
  const referrals = { creditFirstPurchaseBonus: jest.fn() };
  const byl = {
    createCheckout: jest.fn(async () => ({ id: 13338, url: 'https://byl.mn/h/checkout/13338/x' })),
    getCheckout: jest.fn(async () => ({ id: 13338, status: 'complete', amount_total: '56000.00', client_reference_id: 'pay-1' })),
  };
  const redisKeys = new Set<string>();
  const redis = { set: jest.fn(async (k: string) => (redisKeys.has(k) ? null : (redisKeys.add(k), 'OK'))) };
  const manager = {
    save: jest.fn(async (_e: any, p: any) => p),
    update: jest.fn(),
    findOne: jest.fn(async () => user),
  };
  const dataSource = { transaction: jest.fn(async (fn: any) => fn(manager)) };
  const config = { get: (k: string) => ({ BYL_WEBHOOK_SECRET: SECRET, WEB_URL: 'https://web.test', ...env })[k] };
  const svc = new PaymentsService(
    paymentRepo as any, planRepo as any, userRepo as any, referrals as any, promos as any,
    dataSource as any, byl as any, redis as any, config as any,
  );
  return { svc, payments, byl, promos, referrals, manager, redis };
}

const event = (paymentId: string, id = 1) => {
  const raw = Buffer.from(JSON.stringify({ id, type: 'checkout.completed', data: { object: { id: 13338, client_reference_id: paymentId } } }));
  return { raw, sig: createHmac('sha256', SECRET).update(raw).digest('hex') };
};

describe('PaymentsService', () => {
  it('quote: list price, promo discount and the resulting expiry', async () => {
    const { svc } = setup();
    const q = await svc.quote({ id: 'u-1' } as any, { planId: 'plan-plus', promoCode: 'AA' });
    expect(q).toMatchObject({ price: 56_000, discount: 5_600, finalPrice: 50_400, planName: 'Plus' });
    expect(new Date(q.accessUntil).getTime()).toBeGreaterThan(NOW + 29 * 86_400_000);
  });

  it('createCheckout: pending payment + Byl checkout pointing back to the site', async () => {
    const { svc, payments, byl } = setup();
    const out = await svc.createCheckout({ id: 'u-1' } as any, { planId: 'plan-plus' });
    expect(out).toEqual({ paymentId: 'pay-1', checkoutUrl: 'https://byl.mn/h/checkout/13338/x' });
    const body = byl.createCheckout.mock.calls[0][0];
    expect(body).toMatchObject({
      client_reference_id: 'pay-1',
      email_collection: false,
      success_url: 'https://web.test/checkout/success?payment=pay-1',
    });
    expect(body.items[0].price_data.unit_amount).toBe(56_000);
    expect(payments.get('pay-1')).toMatchObject({ status: PaymentStatus.PENDING, provider: 'byl', providerRef: '13338', amount: 56_000 });
  });

  it('createCheckout with a promo sends the discount to Byl', async () => {
    const { svc, byl } = setup();
    await svc.createCheckout({ id: 'u-1' } as any, { planId: 'plan-plus', promoCode: 'AA' });
    expect(byl.createCheckout.mock.calls[0][0].discounts).toEqual([{ amount: 5_600, description: 'Промо код AA' }]);
  });

  it('webhook: bad signature → 401, nothing granted', async () => {
    const { svc, manager } = setup();
    const { raw } = event('pay-1');
    const err = await svc.handleBylWebhook(raw, 'nope').catch((e) => e);
    expect(err.getStatus()).toBe(401);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('webhook: grants the plan once, records promo + referral', async () => {
    const { svc, manager, promos, referrals, payments, byl } = setup();
    await svc.createCheckout({ id: 'u-1' } as any, { planId: 'plan-plus', promoCode: 'AA' });
    byl.getCheckout.mockResolvedValue({ id: 13338, status: 'complete', amount_total: '50400.00', client_reference_id: 'pay-1' });
    const { raw, sig } = event('pay-1');
    await svc.handleBylWebhook(raw, sig);
    expect(payments.get('pay-1').status).toBe(PaymentStatus.PAID);
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), { id: 'u-1' }, expect.objectContaining({ planId: 'plan-plus' }));
    expect(promos.recordDiscountUse).toHaveBeenCalledWith(manager, 'promo-1', 'u-1', 'pay-1');
    expect(referrals.creditFirstPurchaseBonus).toHaveBeenCalledWith(manager, 'u-1');
  });

  it('webhook: the same event twice grants once', async () => {
    const { svc, manager } = setup();
    await svc.createCheckout({ id: 'u-1' } as any, { planId: 'plan-plus' });
    const { raw, sig } = event('pay-1', 9);
    await svc.handleBylWebhook(raw, sig);
    await svc.handleBylWebhook(raw, sig);
    expect(manager.update).toHaveBeenCalledTimes(1);
  });

  it('webhook: a different event id for an already-paid payment does nothing', async () => {
    const { svc, manager } = setup();
    await svc.createCheckout({ id: 'u-1' } as any, { planId: 'plan-plus' });
    await svc.handleBylWebhook(event('pay-1', 1).raw, event('pay-1', 1).sig);
    await svc.handleBylWebhook(event('pay-1', 2).raw, event('pay-1', 2).sig);
    expect(manager.update).toHaveBeenCalledTimes(1);
  });

  it('webhook (live): amount mismatch → no grant, flagged', async () => {
    const { svc, manager, byl, payments } = setup();
    await svc.createCheckout({ id: 'u-1' } as any, { planId: 'plan-plus' });
    byl.getCheckout.mockResolvedValue({ id: 13338, status: 'complete', amount_total: '100.00', client_reference_id: 'pay-1' });
    await svc.handleBylWebhook(event('pay-1').raw, event('pay-1').sig);
    expect(manager.update).not.toHaveBeenCalled();
    expect(payments.get('pay-1').metadata.mismatch).toBe(true);
  });

  it('webhook (BYL_TEST_MODE): Byl test checkouts are always 100₮ — still grants', async () => {
    const { svc, manager, byl } = setup({ BYL_TEST_MODE: 'true' });
    await svc.createCheckout({ id: 'u-1' } as any, { planId: 'plan-plus' });
    byl.getCheckout.mockResolvedValue({ id: 13338, status: 'complete', amount_total: '100.00', client_reference_id: 'pay-1' });
    await svc.handleBylWebhook(event('pay-1').raw, event('pay-1').sig);
    expect(manager.update).toHaveBeenCalledTimes(1);
  });

  it('webhook: checkout not complete at Byl → no grant', async () => {
    const { svc, manager, byl } = setup();
    await svc.createCheckout({ id: 'u-1' } as any, { planId: 'plan-plus' });
    byl.getCheckout.mockResolvedValue({ id: 13338, status: 'open', amount_total: '56000', client_reference_id: 'pay-1' });
    await svc.handleBylWebhook(event('pay-1').raw, event('pay-1').sig);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('webhook: ignores other event types and unknown payments', async () => {
    const { svc, manager } = setup();
    const raw = Buffer.from(JSON.stringify({ id: 5, type: 'invoice.paid', data: { object: {} } }));
    await svc.handleBylWebhook(raw, createHmac('sha256', SECRET).update(raw).digest('hex'));
    await svc.handleBylWebhook(event('missing').raw, event('missing').sig);
    expect(manager.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3:** run → FAIL.

- [ ] **Step 4: Rewrite the money path in `payments.service.ts`**

Keep `findMy`, `findAllPlans`, `createPlan`. Replace `createIntent` / `confirm` and the constructor with:

```ts
import { HttpStatus, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Payment } from '../entities/payment.entity';
import { Plan } from '../entities/plan.entity';
import { User } from '../entities/user.entity';
import { PaymentStatus } from '../common/enums';
import { ReferralsService } from '../referrals/referrals.service';
import { PromosService } from '../promos/promos.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { planAccessAfterPurchase } from './plan-access';
import { BylClient } from './byl/byl.client';
import { verifyBylSignature } from './byl/byl-signature';
import { paymentError } from './payments-errors';

/** Processed Byl event ids — Byl retries for ~4 days; keep a week. */
const EVENT_TTL_SECONDS = 7 * 24 * 3600;

interface PlanMeta {
  type: 'plan';
  planId: string;
  planSlug: string;
  planName: string;
  durationDays: number;
  listPrice: number;
  discount: number;
  promoId?: string;
  promoCode?: string;
  accessUntil?: string;
  mismatch?: boolean;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly referrals: ReferralsService,
    private readonly promos: PromosService,
    private readonly dataSource: DataSource,
    private readonly byl: BylClient,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  /** Price + promo + the expiry this purchase would give. Shown before paying. */
  async quote(user: Pick<User, 'id'>, dto: CreatePaymentDto) {
    const plan = await this.activePlan(dto.planId);
    let finalPrice = plan.priceAmount;
    let promoId: string | undefined;
    let promoCode: string | undefined;
    if (dto.promoCode?.trim()) {
      const q = await this.promos.quote(user.id, dto.promoCode, plan.id);
      finalPrice = q.finalPrice;
      promoId = q.promoId;
      promoCode = q.code;
    }
    if (finalPrice < 100) {
      throw paymentError(HttpStatus.BAD_REQUEST, 'PRICE_TOO_LOW', 'Энэ кодоор төлбөр үүсгэх боломжгүй — «Промо код» хэсэгт оруулна уу.');
    }
    const accessUntil = await this.accessFor(user.id, plan);
    return {
      planId: plan.id,
      planName: plan.name,
      price: plan.priceAmount,
      discount: plan.priceAmount - finalPrice,
      finalPrice,
      accessUntil: accessUntil.toISOString(),
      promoId,
      promoCode,
      plan,
    };
  }

  /** Pending payment + Byl checkout. Nothing is granted here — only the webhook grants. */
  async createCheckout(user: Pick<User, 'id'>, dto: CreatePaymentDto) {
    const q = await this.quote(user, dto);
    const meta: PlanMeta = {
      type: 'plan',
      planId: q.plan.id,
      planSlug: q.plan.slug,
      planName: q.plan.name,
      durationDays: q.plan.durationDays,
      listPrice: q.price,
      discount: q.discount,
      ...(q.promoId ? { promoId: q.promoId, promoCode: q.promoCode } : {}),
    };
    const payment = await this.paymentRepo.save(
      this.paymentRepo.create({
        userId: user.id,
        amount: q.finalPrice,
        currency: 'MNT',
        provider: 'byl',
        status: PaymentStatus.PENDING,
        metadata: meta as unknown as Record<string, unknown>,
      }),
    );

    const web = this.config.get<string>('WEB_URL') ?? '';
    try {
      const checkout = await this.byl.createCheckout({
        items: [
          {
            price_data: {
              unit_amount: q.price,
              product_data: { name: `SparkXP ${q.plan.name} — ${q.plan.durationDays} хоног`, client_reference_id: q.plan.slug },
            },
            quantity: 1,
          },
        ],
        ...(q.discount > 0 ? { discounts: [{ amount: q.discount, description: `Промо код ${q.promoCode}` }] } : {}),
        client_reference_id: payment.id,
        success_url: `${web}/checkout/success?payment=${payment.id}`,
        cancel_url: `${web}/checkout?plan=${q.plan.slug}&canceled=1`,
        email_collection: false, // phone-first users may have no email
      });
      payment.providerRef = String(checkout.id);
      await this.paymentRepo.save(payment);
      return { paymentId: payment.id, checkoutUrl: checkout.url };
    } catch (err) {
      payment.status = PaymentStatus.FAILED;
      await this.paymentRepo.save(payment);
      throw err;
    }
  }

  /**
   * POST /payments/webhook/byl. The ONLY path that grants a purchase.
   * Returns normally for anything we deliberately ignore (Byl stops retrying
   * on 2xx); throws 401 only for a bad signature.
   */
  async handleBylWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
    if (!verifyBylSignature(rawBody, signature, this.config.get<string>('BYL_WEBHOOK_SECRET'))) {
      throw paymentError(HttpStatus.UNAUTHORIZED, 'BAD_SIGNATURE', 'Invalid signature');
    }
    const event = JSON.parse(rawBody!.toString('utf8')) as {
      id: number | string;
      type: string;
      data?: { object?: { id?: number; client_reference_id?: string | null } };
    };
    if (event.type !== 'checkout.completed') return;
    if ((await this.redis.set(`byl:event:${event.id}`, '1', 'EX', EVENT_TTL_SECONDS, 'NX')) === null) return;

    const paymentId = event.data?.object?.client_reference_id ?? '';
    const payment = paymentId ? await this.paymentRepo.findOne({ where: { id: paymentId } }) : null;
    if (!payment || payment.provider !== 'byl') {
      this.logger.warn(`Byl event ${event.id}: no byl payment ${paymentId}`);
      return;
    }
    if (payment.status === PaymentStatus.PAID) return;

    // Defence in depth: ask Byl itself instead of trusting the event body.
    const checkout = await this.byl.getCheckout(payment.providerRef ?? '');
    if (checkout.status !== 'complete') {
      this.logger.warn(`Byl checkout ${checkout.id} is ${checkout.status} — not granting ${payment.id}`);
      return;
    }
    const paid = Math.round(Number(checkout.amount_total));
    const meta = payment.metadata as unknown as PlanMeta;
    if (paid !== payment.amount) {
      if (this.config.get<string>('BYL_TEST_MODE') === 'true') {
        this.logger.log(`Byl test mode: paid ${paid}₮ for ${payment.amount}₮ (test checkouts are fixed at 100₮)`);
      } else {
        this.logger.error(`Byl amount mismatch on ${payment.id}: paid ${paid}, expected ${payment.amount}`);
        payment.metadata = { ...meta, mismatch: true } as unknown as Record<string, unknown>;
        await this.paymentRepo.save(payment);
        return;
      }
    }

    await this.grant(payment, meta);
  }

  /** The buyer's own payment, for the website's success page. */
  async findOne(user: Pick<User, 'id'>, id: string) {
    const p = await this.paymentRepo.findOne({ where: { id } });
    if (!p || p.userId !== user.id) throw new NotFoundException('Төлбөр олдсонгүй');
    const meta = (p.metadata ?? {}) as Partial<PlanMeta>;
    return { id: p.id, status: p.status, planName: meta.planName ?? null, accessUntil: meta.accessUntil ?? null };
  }

  private async grant(payment: Payment, meta: PlanMeta): Promise<void> {
    const plan = await this.planRepo.findOne({ where: { id: meta.planId } });
    if (!plan) {
      this.logger.error(`Paid payment ${payment.id} references missing plan ${meta.planId}`);
      return;
    }
    await this.dataSource.transaction(async (manager) => {
      const buyer = await manager.findOne(User, { where: { id: payment.userId! }, relations: { plan: true } });
      const until =
        planAccessAfterPurchase(
          { planId: buyer?.planId ?? null, planExpiresAt: buyer?.planExpiresAt ?? null, planPrice: buyer?.plan?.priceAmount ?? 0 },
          { planId: plan.id, price: plan.priceAmount, durationDays: plan.durationDays },
        ) ??
        // Unlimited plan was active (quote refused, but a race got here): don't shorten it.
        null;

      payment.status = PaymentStatus.PAID;
      payment.metadata = { ...meta, accessUntil: until?.toISOString() } as unknown as Record<string, unknown>;
      await manager.save(Payment, payment);
      if (until) await manager.update(User, { id: payment.userId! }, { planId: plan.id, planExpiresAt: until });
      if (meta.promoId) await this.promos.recordDiscountUse(manager, meta.promoId, payment.userId!, payment.id);
      await this.referrals.creditFirstPurchaseBonus(manager, payment.userId!);
    });
  }

  private async activePlan(planId: string): Promise<Plan> {
    const plan = await this.planRepo.findOne({ where: { id: planId, isActive: true } });
    if (!plan) throw paymentError(HttpStatus.NOT_FOUND, 'PLAN_NOT_FOUND', 'Багц олдсонгүй');
    return plan;
  }

  private async accessFor(userId: string, plan: Plan): Promise<Date> {
    const u = await this.userRepo.findOne({ where: { id: userId }, relations: { plan: true } });
    const until = planAccessAfterPurchase(
      { planId: u?.planId ?? null, planExpiresAt: u?.planExpiresAt ?? null, planPrice: u?.plan?.priceAmount ?? 0 },
      { planId: plan.id, price: plan.priceAmount, durationDays: plan.durationDays },
    );
    if (!until) {
      throw paymentError(HttpStatus.CONFLICT, 'PLAN_SWITCH_BLOCKED', 'Таны одоогийн багц хугацаагүй тул өөр багц авах боломжгүй.');
    }
    return until;
  }
```

`findAll()` (admin) changes to include `user` with `username`/`phone` (relation load already returns them) and adds a CSV builder:

```ts
  /** Admin CSV for the accountant (manual e-barimt — spec decision 4). */
  async exportCsv(): Promise<string> {
    const rows = await this.findAll();
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['date', 'payment_id', 'user', 'phone', 'plan', 'list_price', 'discount', 'amount', 'status', 'byl_checkout'];
    const lines = rows.map((p) => {
      const m = (p.metadata ?? {}) as Partial<PlanMeta>;
      return [p.createdAt.toISOString(), p.id, p.user?.username ?? p.user?.fullName, p.user?.phone, m.planName,
        m.listPrice, m.discount, p.amount, m.mismatch ? 'mismatch' : p.status, p.providerRef].map(esc).join(',');
    });
    return [head.join(','), ...lines].join('\n');
  }
```

Check `User` has a `plan` relation property named `plan` (`grep -n "plan:" backend/src/entities/user.entity.ts`); if it is named differently use that name in both `relations`.

- [ ] **Step 5:** `cd backend && npx jest src/payments/ && npx tsc --noEmit -p tsconfig.json` → PASS / clean. (tsc will fail until B5 removes the controller's `confirm` — do B5 before this check if needed.)
- [ ] **Step 6:** commit after B5.

---

### Task B5: Controller, module, raw body, CORS

**Files:** Modify `payments.controller.ts`, `payments.module.ts`, `main.ts`, `guards/payments-enabled.guard.ts`

- [ ] **Step 1: Controller** — replace the class body's money routes:

```ts
import { Body, Controller, ConflictException, Get, Header, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
// … existing imports (JwtAuthGuard, RolesGuard, Roles, CurrentUser, UserRole, User, PaymentsEnabledGuard, CreatePlanDto)
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  /** Price + promo + resulting expiry, before paying (website checkout page). */
  @Get('quote')
  @UseGuards(JwtAuthGuard)
  async quote(@Query() dto: CreatePaymentDto, @CurrentUser() user: User) {
    const { plan: _plan, ...q } = await this.service.quote(user, dto);
    return q;
  }

  /** Pending payment + Byl checkout → { paymentId, checkoutUrl }. Grants nothing. */
  @Post()
  @UseGuards(JwtAuthGuard, PaymentsEnabledGuard)
  createCheckout(@Body() dto: CreatePaymentDto, @CurrentUser() user: User) {
    return this.service.createCheckout(user, dto);
  }

  /**
   * Byl → us. Signature-verified; the ONLY route that grants a purchase.
   * Public by design (Byl has no JWT); never throttled — Byl retries must land.
   */
  @Post('webhook/byl')
  @HttpCode(200)
  @SkipThrottle()
  async bylWebhook(@Req() req: Request & { rawBody?: Buffer }, @Headers('byl-signature') signature?: string) {
    await this.service.handleBylWebhook(req.rawBody, signature);
    return { ok: true };
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  findMy(@CurrentUser() user: User) {
    return this.service.findMy(user);
  }

  @Get('plans')
  findPlans() {
    return this.service.findAllPlans();
  }

  @Get('export.csv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="sparkxp-payments.csv"')
  exportCsv() {
    return this.service.exportCsv();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findAll() {
    return this.service.findAll();
  }

  // createPlan stays as it is.

  /** The buyer's own payment — website success page polls this. Declared LAST: `:id` would swallow the static paths. */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.findOne(user, id);
  }
}
```

The `confirm` route and its import are gone.

- [ ] **Step 2: Module** — add `BylClient` to providers.

- [ ] **Step 3: `main.ts` raw body** — change the json parser line to:

```ts
  // The Byl webhook signs the RAW body; keep the bytes for that one route only
  // (storing them for every 15 MB batch request would double memory for nothing).
  app.use(
    json({
      limit: '15mb',
      verify: (req: IncomingMessage & { rawBody?: Buffer }, _res, buf) => {
        if (req.url?.startsWith('/api/payments/webhook/')) req.rawBody = buf;
      },
    }),
  );
```

with `import type { IncomingMessage } from 'http';`.

- [ ] **Step 4: CORS** — next to the `ADMIN_ORIGIN` spread add the same for `WEB_ORIGIN`:

```ts
    ...config
      .get<string>('WEB_ORIGIN', '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
```

(match the exact chain the `ADMIN_ORIGIN` entry uses).

- [ ] **Step 5: Guard comment** — rewrite the doc on `PaymentsEnabledGuard`: confirm no longer exists; the flag now only opens checkout creation; access is granted solely by the signed webhook.

- [ ] **Step 6: Verify** — `cd backend && npx tsc --noEmit -p tsconfig.json && npm test` → clean/green. Then commit B4+B5:

```bash
git add backend/src
git commit -m "feat(payments): Byl checkout + гарын үсэгтэй webhook; confirm route устгав"
```

- [ ] **Step 7: Local smoke test** — start `npm run start:dev`; with no `BYL_*` set:
  - `POST /api/payments` (with `PAYMENTS_ENABLED=true` locally and a JWT) → 503 `PAYMENT_UNAVAILABLE`.
  - `POST /api/payments/<uuid>/confirm` → 404.
  - Webhook with a body signed by a local `BYL_WEBHOOK_SECRET=whsec_local` for a pending payment you insert → payment `paid`, user plan set:

```bash
BODY='{"id":1,"type":"checkout.completed","data":{"object":{"id":1,"client_reference_id":"<payment id>"}}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac whsec_local | awk '{print $2}')
curl -s -X POST localhost:3000/api/payments/webhook/byl -H 'Content-Type: application/json' -H "Byl-Signature: $SIG" -d "$BODY"
```

  (`getCheckout` needs a token — for this local test set `BYL_TEST_MODE=true` and temporarily point the payment's `providerRef` at a Byl test checkout, or skip: the service-level tests already cover the grant.)

---

### Task B6: Plans match the client brief

**Files:** Create `backend/src/migrations/1788300000000-PlansMatchClientBrief.ts`

- [ ] **Step 1:**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plans as approved by the client on 2026-09-28 (docs 01–03):
 * Essential 34k (name only — slug `standard` stays; the app already calls it
 * Essential), Plus 56k → 70 TTS / 200 STT min, Premier 85k → 105 / 300.
 * The website now sells these, so what we sell must match what we deliver.
 */
export class PlansMatchClientBrief1788300000000 implements MigrationInterface {
  name = 'PlansMatchClientBrief1788300000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE "plans" SET "name" = 'Essential' WHERE "slug" = 'standard'`);
    await q.query(`UPDATE "plans" SET "voice_minutes_limit" = 70, "stt_minutes_limit" = 200 WHERE "slug" = 'plus'`);
    await q.query(`UPDATE "plans" SET "voice_minutes_limit" = 105, "stt_minutes_limit" = 300 WHERE "slug" = 'premier'`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE "plans" SET "name" = 'Standard' WHERE "slug" = 'standard'`);
    await q.query(`UPDATE "plans" SET "voice_minutes_limit" = 50, "stt_minutes_limit" = 120 WHERE "slug" = 'plus'`);
    await q.query(`UPDATE "plans" SET "voice_minutes_limit" = NULL, "stt_minutes_limit" = NULL WHERE "slug" = 'premier'`);
  }
}
```

- [ ] **Step 2:** commit `feat(db): багцуудыг захиалагчийн баримттай тааруулав (Essential, Plus 70/200, Premier 105/300)`.

---

### Task B7: Env + API docs

- [ ] `.env.example` block:

```
# ── Byl (byl.mn) web payments ────────────────────────────────────────────────
# Byl dashboard → project → Settings → API token; project id from project settings.
BYL_API_TOKEN=
BYL_PROJECT_ID=
# Webhooks → endpoint → Signing secret. Endpoint URL:
#   https://<api host>/api/payments/webhook/byl   (event: checkout.completed)
BYL_WEBHOOK_SECRET=
# Byl test projects charge a fixed 100₮ — skip the amount check while testing.
BYL_TEST_MODE=true
# Marketing site (checkout pages + Byl success/cancel redirects) and its CORS origin(s).
WEB_URL=https://spark-xp-web.vercel.app
WEB_ORIGIN=https://spark-xp-web.vercel.app
```

- [ ] `API.md` §17 Payments: replace the table with the B5 routes (quote / POST / webhook / my / plans / export.csv / GET / :id), remove `confirm`, add the error-code table from spec §7 and a short Byl note (signature, idempotency, test mode). Admin map: Monitor → `GET /payments/export.csv`.
- [ ] Commit `docs(api): Byl төлбөрийн endpoint-ууд` and push.

---

# PART A — Admin

### Task A1: Payments table + CSV

**Files:** Modify `admin/src/pages/monitor/MonitorPage.tsx`

- [ ] **Step 1:** extend the `Payment` interface:

```ts
interface Payment {
  id: string; amount: number; currency: string;
  status: string; provider: string | null; providerRef: string | null; createdAt: string;
  metadata?: {
    type?: string; planName?: string; sparksToCredit?: number;
    listPrice?: number; discount?: number; promoCode?: string; mismatch?: boolean; accessUntil?: string;
  } | null;
  user?: { email: string | null; fullName: string; username: string | null; phone: string | null };
}
```

- [ ] **Step 2:** user column shows `username ?? fullName` + `phone ?? email`; amount column shows `amount` and, when `discount > 0`, a gray line `-{discount}₮ {promoCode}`; status column shows a red «зөрүү» badge when `metadata.mismatch`; add a «Byl» column with `providerRef`.

- [ ] **Step 3:** CSV button above the table:

```tsx
async function downloadCsv() {
  const blob = await api.getBlob('/payments/export.csv');
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'sparkxp-payments.csv' });
  a.click();
  URL.revokeObjectURL(url);
}
```

Open `admin/src/api/client.ts`; if there is no blob helper add `getBlob(path)` next to `get` (same auth header, `return res.blob()`).

- [ ] **Step 4:** `cd admin && npm run build` → ok. Commit `feat(admin): төлбөрийн жагсаалт (Byl дугаар, хөнгөлөлт, зөрүү) + CSV`.

---

# PART M — Mobile

### Task M1: Remove the upgrade CTA (anti-steering)

**Files:** Modify `mobile/app/plan.tsx`

- [ ] Delete the CTA `<Pressable …>` block (the one calling `Alert.alert(ctaLabel, t('planUpgradeSoon'))`), the `ctaLabel` / `onCurrentPlan` / `selectedName` consts, the `selectedPlan` state and the `selected`/`onPress` props on both `PlanCard`s (cards become informational; `active` badge stays). Remove now-unused imports (`Alert`, `AppIcon` if unused). Leave a one-line comment where the CTA was:

```tsx
          {/* No purchase button or link: plans are bought on the website, and App
              Store rules forbid steering users there from inside the app. */}
```

- [ ] `cd mobile && npx tsc --noEmit && npx eslint app/plan.tsx` → clean. Commit `fix(mobile): багцын дэлгэцээс upgrade товч хасав (App Store anti-steering)`.

---

# PART W — Website (`~/Desktop/Projects/SparkXP_web`)

> Separate repo. `git checkout -b feature/web-checkout`. Run with `npm run dev` (port 3000 clashes with the API — use `npm run dev -- -p 3100`) and `NEXT_PUBLIC_API_URL=http://localhost:3000/api`.

### Task W1: API + session helpers

**Files:** Create `src/lib/session.ts`, `src/lib/api.ts`, `.env.example`

- [ ] **`src/lib/session.ts`**

```ts
"use client";

/** The website's own login (same JWT as the app). localStorage, guarded — private mode can throw. */
const KEY = "sparkxp.web.token";

export function getToken(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function setToken(token: string): void {
  try { localStorage.setItem(KEY, token); } catch { /* private mode: session-only */ }
}

export function clearToken(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
```

- [ ] **`src/lib/api.ts`**

```ts
"use client";

import { clearToken, getToken } from "./session";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://sparkxp-production.up.railway.app/api";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** fetch + JSON + bearer token + the backend's `{ code, message }` errors. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) clearToken();
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
    throw new ApiError(res.status, msg ?? "Алдаа гарлаа. Дахин оролдоно уу.", data?.code);
  }
  return data as T;
}

export interface Plan { id: string; name: string; slug: string; priceAmount: number; durationDays: number; isActive: boolean }
export interface MyPlan { isFree: boolean; planName: string; expiresAt: string | null }
export interface Quote { planId: string; planName: string; price: number; discount: number; finalPrice: number; accessUntil: string }
export interface PhoneSession { verificationId: string; smsUri: string; displayInstruction: string; expiresAt: string }
export interface AuthResult { accessToken: string; user: { username: string | null; fullName: string } }
```

- [ ] **`.env.example`:** `NEXT_PUBLIC_API_URL=https://sparkxp-production.up.railway.app/api` and `NEXT_PUBLIC_PAYMENTS_OPEN=false` with a comment that the buy buttons appear only when it is `true`.

- [ ] `npx tsc --noEmit` → clean. Commit `feat: API ба session туслахууд`.

### Task W2: i18n strings

**Files:** Modify `src/lib/i18n.ts` (both `mn` and `en` — `en` is typed `typeof mn`)

- [ ] Add a `pricing.openTitle`, `pricing.openSubtitle`, `pricing.buy` and replace the Standard/Plus/Premier plan entries with the client-approved content, each gaining `slug`:

```ts
      { slug: "standard", name: "Essential", price: "₮34,000", blurb: "Өдөр бүр ярьж дасахад.", cta: "Удахгүй", soon: true,
        features: ["Бүх үндсэн хичээл", "AI Buddy-тэй яриа — сард 35 минут", "Таны яриаг таних — сард 100 минут", "AI толь бичиг — сард 300 хайлт"] },
      { slug: "plus", name: "Plus", price: "₮56,000", blurb: "Илүү их ярианы цаг хэрэгтэй бол.", cta: "Удахгүй", soon: true,
        features: ["Essential-ийн бүх давуу тал", "AI Buddy-тэй яриа — сард 70 минут", "Таны яриаг таних — сард 200 минут"] },
      { slug: "premier", name: "Premier", price: "₮85,000", blurb: "Хамгийн их хэрэглээнд.", cta: "Удахгүй", soon: true,
        features: ["Plus-ийн бүх давуу тал", "AI Buddy-тэй яриа — сард 105 минут", "Таны яриаг таних — сард 300 минут"] },
```

(the free plan gets `slug: "free"`). Add `login` and `checkout` sections:

```ts
  login: {
    title: "Нэвтрэх",
    subtitle: "SparkXP аппын дансаараа нэвтэрнэ үү.",
    tabPassword: "Нууц үгээр",
    tabSms: "SMS-ээр",
    identifier: "Нэвтрэх нэр, утас эсвэл имэйл",
    password: "Нууц үг",
    phone: "Утасны дугаар",
    submit: "Нэвтрэх",
    smsStart: "Үргэлжлүүлэх",
    smsWaiting: "Таны SMS-ийг хүлээж байна…",
    smsExpired: "Кодын хугацаа дууссан. Дахин оролдоно уу.",
    smsCost: "Оператор SMS бүрд 150₮ тооцно.",
    noAccount: "Данс байхгүй юу? Бүртгэлээ SparkXP аппаас үүсгэнэ.",
    getApp: "Апп татах",
  },
  checkout: {
    title: "Багц авах",
    current: "Одоогийн багц",
    free: "Үнэгүй",
    until: "хүртэл",
    promo: "Промо код",
    apply: "Шалгах",
    price: "Үнэ",
    discount: "Хөнгөлөлт",
    total: "Төлөх дүн",
    accessUntil: "Таны эрх хүчинтэй болох хугацаа",
    pay: "Төлөх",
    canceled: "Төлбөр цуцлагдлаа. Дахин оролдож болно.",
    closed: "Төлбөр одоогоор хаалттай байна.",
    logout: "Гарах",
    successTitle: "Баярлалаа!",
    successBody: "{plan} багц {date} хүртэл идэвхтэй боллоо. Аппаа нээгээд үргэлжлүүлээрэй.",
    waiting: "Төлбөр баталгаажихыг хүлээж байна…",
    waitingLong: "Банкны шилжүүлгээр төлсөн бол баталгаажихад хэдэн цаг болж магадгүй. Энэ хуудсыг хаасан ч эрх автоматаар нээгдэнэ.",
  },
```

and the English twins (same keys, English text). `npx tsc --noEmit` → clean. Commit `feat(i18n): нэвтрэх, checkout текст + багцын агуулгыг баримттай тааруулав`.

### Task W3: Pricing buttons behind the flag

**Files:** Modify `src/components/pricing.tsx`

- [ ] `const open = process.env.NEXT_PUBLIC_PAYMENTS_OPEN === "true";` — when `open`: hide the `soonBanner`, use `openTitle`/`openSubtitle` in `SectionHeading`, and for paid plans render `<a href={`/checkout?plan=${plan.slug}`}>{t.pricing.buy}</a>` with the existing gradient button classes and badge `availableLabel`. When not open: unchanged. Commit `feat: үнийн хэсэгт «Худалдан авах» (NEXT_PUBLIC_PAYMENTS_OPEN)`.

### Task W4: Login page

**Files:** Create `src/components/auth-shell.tsx`, `src/app/login/page.tsx`

- [ ] **`auth-shell.tsx`** — `SiteHeader` + centered card (`mx-auto max-w-md rounded-3xl border border-line bg-surface-2/60 p-7`) + `SiteFooter`; props `{ title, subtitle?, children }`.

- [ ] **`login/page.tsx`** — `"use client"`; wrap the body in `<Suspense>` (Next requires it for `useSearchParams`). State: `tab` (`password|sms`), fields, `error`, `busy`, SMS `session`, `status`.
  - Password: `api<AuthResult>("/auth/login", { method: "POST", body: { identifier, password } })` → `setToken` → `router.replace(next ?? "/checkout")`.
  - SMS: `api<PhoneSession>("/auth/phone/start", { method: "POST", body: { phone, purpose: "login" } })` → show the code big (parse `body=` from `smsUri`) + `displayInstruction` verbatim + an `<a href={smsUri}>` button labelled «SMS илгээх» shown only on touch devices (`matchMedia("(pointer: coarse)")`) + cost note; poll `GET /auth/phone/status/:id` every 3 s until `verified` → `POST /auth/phone/login { verificationId }` → `setToken` → redirect; `expired` → `smsExpired` and back to the phone field. Clear the interval on unmount.
  - Errors: show `ApiError.message` (backend messages are Mongolian).
  - Footer: `noAccount` + link `/#download`.
  - `next` param is accepted only if it starts with `/` (no open redirect).

- [ ] Manual: `npm run dev -- -p 3100` → `/login` → password login with a local account → lands on `/checkout`. Commit `feat: /login (нууц үг · SMS)`.

### Task W5: Checkout page

**Files:** Create `src/app/checkout/page.tsx`

- [ ] `"use client"` + `<Suspense>`. On mount: no token → `router.replace("/login?next=" + encodeURIComponent(location.pathname + location.search))`. Load `GET /payments/plans` (filter `isActive && priceAmount > 0`), `GET /users/me/plan`. Selected plan from `?plan=` slug (default `plus`). Whenever plan or applied promo changes: `GET /payments/quote?planId=…&promoCode=…` → show price / discount / total / `accessUntil` (format `YYYY.MM.DD`). Promo input + «Шалгах» (re-quote; show error inline). «Төлөх» → `POST /payments { planId, promoCode }` → `window.location.assign(checkoutUrl)`. `503` with no `code` (guard closed) → `checkout.closed`. `?canceled=1` → banner. «Гарах» clears the token. Plan picker = three radio cards reusing the pricing card look.
- [ ] Manual (local backend, `PAYMENTS_ENABLED=true`, no Byl token): quote renders; «Төлөх» shows the 503 message. Commit `feat: /checkout`.

### Task W6: Success page

**Files:** Create `src/app/checkout/success/page.tsx`

- [ ] `"use client"` + `<Suspense>`. Read `?payment=`; poll `GET /payments/:id` every 3 s for up to 3 min. `paid` → `successTitle` + `successBody` with `{plan}` / `{date}` from `planName` / `accessUntil`, plus «Апп татах» link. Still pending after 3 min → `waiting` + `waitingLong` (stop polling). `404/401` → link back to `/checkout`.
- [ ] `npm run lint && npm run build` → ok. Commit `feat: /checkout/success` and push the branch.

---

# PART R — Release

- [ ] **R1 (user):** Byl → test project → API token, project id, webhook endpoint `https://sparkxp-production.up.railway.app/api/payments/webhook/byl` (event `checkout.completed`) → signing secret. User sets in Railway: `BYL_API_TOKEN`, `BYL_PROJECT_ID`, `BYL_WEBHOOK_SECRET`, `BYL_TEST_MODE=true`, `WEB_URL`, `WEB_ORIGIN`. Vercel (SparkXP_web): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PAYMENTS_OPEN=false`.
- [ ] **R2:** SparkXP PR (ask first) → merge → Railway. Check deploy log: no `BYL_API_TOKEN … not set` warning; `GET /payments/plans` shows «Essential» and new limits (migration ran).
- [ ] **R3:** SparkXP_web PR (ask first) → merge → Vercel.
- [ ] **R4 (test mode, 100₮):** user sets `PAYMENTS_ENABLED=true` temporarily → on the website (preview with `NEXT_PUBLIC_PAYMENTS_OPEN=true` or direct `/checkout`): login → checkout → pay 100₮ via QPay → success page shows paid → app «Миний багц» shows the plan → admin Monitor shows the payment. Then `PAYMENTS_ENABLED=false` again until Live.
- [ ] **R5 (Live, user):** business verification (Aether Tech Core LLC) + Byl plan + primary bank account → switch project to Live → Live token/secret into Railway → `BYL_TEST_MODE=false`, `PAYMENTS_ENABLED=true`; Vercel `NEXT_PUBLIC_PAYMENTS_OPEN=true` → redeploy.
- [ ] **R6:** `CLAUDE.md` Current Status entry (routes, env, migration, «апп дотор худалдан авах товч хэзээ ч бүү нэм», manual e-barimt via CSV). Mobile M1 ships in the next build.

---

## Self-review

- Spec §1 decisions → B1 (rules), B4 (checkout + discounts), A1 (CSV for e-barimt), M1 (anti-steering). §2 Byl facts → B2/B3/B4. §3.2 routes → B5. §3.3 → B4 `createCheckout`. §3.4 → B4 `handleBylWebhook` + B5 raw body/SkipThrottle. §3.5 → B1. §3.6 → B6. §3.7 → B5/B7. §4 → W1–W6. §5 → M1. §6 → A1. §7 → `paymentError` codes. §8 → B1–B4 tests + R4. §9 → R1–R6.
- Added in planning: `PRICE_TOO_LOW` (Byl minimum / a 100 % code belongs on the promo screen); `NEXT_PUBLIC_PAYMENTS_OPEN` so the site can deploy before Live.
- Names: `planAccessAfterPurchase`, `verifyBylSignature`, `BylClient.createCheckout/getCheckout`, `paymentError/paymentUnavailable`, `PaymentsService.quote/createCheckout/handleBylWebhook/findOne/exportCsv`.
