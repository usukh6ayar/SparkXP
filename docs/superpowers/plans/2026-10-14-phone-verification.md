# Phone Verification (verify.mn) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a verified Mongolian phone number the primary account key — phone sign-up, phone/SMS login, phone password reset, phone linking + a gate for legacy email accounts — and ship it to the App Store as build 18.

**Spec:** `docs/superpowers/specs/2026-10-13-phone-verification-design.md` · **Design:** https://claude.ai/artifact/RdFVxctEQJoaQCqzLtDrBN

**Architecture:** verify.mn is *mobile-originated* SMS: the user texts a code from their own phone to 144773. Our backend opens a verify.mn session, keeps a Redis record under **our own** `verificationId`, and the app polls our `status` endpoint every 3 s; the backend asks verify.mn. On `VERIFIED` the backend mints a **single-use proof** bound to phone + purpose (`register | login | reset | link`), which exactly one consumer endpoint can spend. No verify.mn callback (it is unsigned).

**Tech Stack:** NestJS 11 + TypeORM 0.3 + ioredis 5 (backend) · Vite/React (admin) · Expo SDK 54 + expo-router (mobile) · Jest.

**Branch:** all work on `usukhbayar` (re-check `git branch --show-current` before every commit). Push freely; **ask the user before `gh pr create`**.

---

## Deviations from the spec (decided while planning — read first)

1. **Module location.** The spec named `src/phone-verification/`. The consumer endpoints need `AuthService` and `UsersService`, and `UsersModule` cannot import a module that imports it back. So the phone code lives **inside `AuthModule`** at `backend/src/auth/phone/` (same folder pattern as `auth/social/`). Dependency direction stays one-way: `AuthModule → UsersModule`.
2. **All phone routes in one controller** (`auth/phone/phone.controller.ts`) with full paths, including `POST /users/me/phone/start`, `POST /users/me/phone` and admin `DELETE /users/:id/phone`. `UsersController` is untouched.
3. **Phone row goes on the Account screen** (`app/account.tsx`, next to «Имэйл солих» / «Нууц үг солих»), not on `settings.tsx` — that is where account credentials already live.
4. **One screen for gate + link** (`app/phone-link.tsx`, `?gate=1` hides «Буцах» and shows «Гарах»). It is outside `(auth)` because `RootNavigator` throws logged-in users out of `(auth)`.
5. **`buildAuthResult` becomes async** — it now computes `needsPhone` (needs a `user_identities` lookup). Every caller gets an `await`.
6. **Social sign-up when the provider email is held by an *unverified* account:** the new social account is created with `email: null` (the unique index forbids a duplicate; touching the other account is not ours to do).
7. No custom `PhoneInput` component (YAGNI) — the existing `TextField` with `keyboardType="number-pad"`, `maxLength={8}` and a `call-outline` icon.

---

## File map

**Backend — create**
- `backend/src/auth/phone/phone.ts` — `tryNormalizePhone`, `normalizePhone`, `phoneError()` helper.
- `backend/src/auth/phone/verify-mn.client.ts` — the two verify.mn HTTP calls + fake mode + boot guard.
- `backend/src/auth/phone/phone-verification.service.ts` — Redis records, rate limit, proofs.
- `backend/src/auth/phone/phone.controller.ts` — every phone route.
- `backend/src/auth/phone/dto/phone.dto.ts` — request DTOs.
- `backend/src/auth/phone/phone.spec.ts`, `verify-mn.client.spec.ts`, `phone-verification.service.spec.ts`, `test/fake-redis.ts`.
- `backend/src/auth/auth-phone.spec.ts` — auth flows (register/login/reset/link/login-by-phone).
- `backend/src/auth/social/social-auth.service.spec.ts` — regression for the unverified-email link hole.
- `backend/src/migrations/1788200000000-AddPhoneVerification.ts`.

**Backend — modify**
- `backend/src/entities/user.entity.ts` — `email: string | null`, `phoneVerifiedAt`.
- `backend/src/users/users.service.ts` — `create({ email: string | null })`, phone helpers.
- `backend/src/auth/auth.service.ts` — `PublicUser`, async `buildAuthResult`, phone flows, login-by-phone, verified-only email reset.
- `backend/src/auth/auth.controller.ts` — `me` uses `publicUser()`.
- `backend/src/auth/auth.module.ts` — register new providers/controller.
- `backend/src/auth/strategies/jwt.strategy.ts` — `email: string | null`.
- `backend/src/auth/social/social-auth.service.ts` — verified-only linking + `await buildAuthResult`.
- `backend/src/users/account-deletion.service.ts` — `clearRedis` with nullable email.
- `backend/.env.example`, `API.md`.

**Admin — modify:** `admin/src/pages/users/UsersPage.tsx`.

**Mobile — create**
- `mobile/src/api/phone.ts`
- `mobile/src/lib/smsUri.ts`
- `mobile/src/lib/usePhoneVerification.ts`
- `mobile/src/components/PhoneVerifyCard.tsx`
- `mobile/app/(auth)/phone-login.tsx`
- `mobile/app/phone-link.tsx`

**Mobile — modify**
- `mobile/src/api/auth.ts` (types), `mobile/src/i18n/index.ts`, `mobile/app/(auth)/register.tsx`, `mobile/app/(auth)/onboarding/account.tsx`, `mobile/src/components/SignInSheet.tsx`, `mobile/app/(auth)/forgot.tsx`, `mobile/app/account.tsx`, `mobile/app/_layout.tsx`.

**Docs:** `CLAUDE.md` (Current Status), `API.md`.

---

# PART A — Backend

### Task A1: Phone normalization

**Files:**
- Create: `backend/src/auth/phone/phone.ts`
- Test: `backend/src/auth/phone/phone.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/auth/phone/phone.spec.ts
import { HttpException } from '@nestjs/common';
import { normalizePhone, tryNormalizePhone } from './phone';

describe('tryNormalizePhone', () => {
  it.each([
    ['99112233', '99112233'],
    ['9911 2233', '99112233'],
    ['9911-2233', '99112233'],
    ['+976 9911 2233', '99112233'],
    ['97699112233', '99112233'],
    ['(88) 11-22-33', '88112233'],
  ])('%s → %s', (input, expected) => {
    expect(tryNormalizePhone(input)).toBe(expected);
  });

  it.each(['9911223', '991122334', '19112233', '4911223a', '', 'abcdefgh'])(
    'rejects %p',
    (input) => {
      expect(tryNormalizePhone(input)).toBeNull();
    },
  );
});

describe('normalizePhone', () => {
  it('throws INVALID_PHONE with a code the app can match', () => {
    try {
      normalizePhone('123');
      fail('expected a throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(400);
      expect((err as HttpException).getResponse()).toMatchObject({ code: 'INVALID_PHONE' });
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd backend && npx jest src/auth/phone/phone.spec.ts`
Expected: FAIL — `Cannot find module './phone'`.

- [ ] **Step 3: Implement**

```ts
// backend/src/auth/phone/phone.ts
import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Mongolian mobile numbers are 8 digits and start with 5–9
 * (Mobicom 99/95/94/85, Unitel 88/89/86/80, Skytel 91/96/90, G-Mobile 98/93, ONDO 60/66 …).
 */
const PHONE_RE = /^[5-9]\d{7}$/;

/**
 * "+976 9911-2233" → "99112233". Returns null when it is not a Mongolian
 * mobile number. The ONE place phones are normalised — every lookup and every
 * write goes through it, so "9911 2233" and "99112233" are the same account.
 */
export function tryNormalizePhone(input: string): string | null {
  let digits = (input ?? '').replace(/[\s\-()]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.length === 11 && digits.startsWith('976')) digits = digits.slice(3);
  return PHONE_RE.test(digits) ? digits : null;
}

/** Like `tryNormalizePhone` but throws 400 `INVALID_PHONE`. */
export function normalizePhone(input: string): string {
  const phone = tryNormalizePhone(input);
  if (!phone) throw phoneError(HttpStatus.BAD_REQUEST, 'INVALID_PHONE', 'Утасны дугаар 8 оронтой байх ёстой');
  return phone;
}

/**
 * Error with a machine-readable `code`. The app matches the code, never the
 * Mongolian message (same contract as `EMAIL_NOT_VERIFIED`).
 */
export function phoneError(status: HttpStatus, code: string, message: string): HttpException {
  return new HttpException({ statusCode: status, code, message }, status);
}
```

`HttpException` (not `BadRequestException`) so one helper covers 400/404/409/429/503.

- [ ] **Step 4: Run it to see it pass**

Run: `cd backend && npx jest src/auth/phone/phone.spec.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/phone/phone.ts backend/src/auth/phone/phone.spec.ts
git commit -m "feat(auth): утасны дугаар normalize хийх туслах"
```

---

### Task A2: verify.mn client

**Files:**
- Create: `backend/src/auth/phone/verify-mn.client.ts`
- Test: `backend/src/auth/phone/verify-mn.client.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/auth/phone/verify-mn.client.spec.ts
import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { VerifyMnClient, VerifyMnConflictError } from './verify-mn.client';

const config = (env: Record<string, string | undefined>) =>
  ({ get: (k: string) => env[k] }) as unknown as ConfigService;

const json = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('VerifyMnClient', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
  });

  const live = () => new VerifyMnClient(config({ VERIFY_MN_API_KEY: 'vrf_test' }));

  it('creates a session with the key and returns what the app needs', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      json(201, {
        sessionId: 's1',
        smsUri: 'sms:144773?body=482916',
        displayInstruction: 'Та өөрийн 99112233 …',
        expiresAt: '2026-10-14T10:05:00.000Z',
      }),
    );
    global.fetch = fetchMock;

    const s = await live().createSession('99112233', '482916');

    expect(s).toEqual({
      sessionId: 's1',
      smsUri: 'sms:144773?body=482916',
      displayInstruction: 'Та өөрийн 99112233 …',
      expiresAt: '2026-10-14T10:05:00.000Z',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.verify.mn/sessions');
    expect(init.headers.Authorization).toBe('Bearer vrf_test');
    expect(JSON.parse(init.body)).toEqual({ phone: '99112233', text: '482916' });
  });

  it('maps 409 (same phone+text still active) to VerifyMnConflictError', async () => {
    global.fetch = jest.fn().mockResolvedValue(json(409, {}));
    await expect(live().createSession('99112233', '111111')).rejects.toBeInstanceOf(VerifyMnConflictError);
  });

  it.each([401, 500])('maps %i to 503 SMS_UNAVAILABLE', async (status) => {
    global.fetch = jest.fn().mockResolvedValue(json(status, {}));
    const err = await live().createSession('99112233', '111111').catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(503);
    expect(err.getResponse()).toMatchObject({ code: 'SMS_UNAVAILABLE' });
  });

  it('maps a network failure to 503', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const err = await live().getStatus('s1').catch((e) => e);
    expect(err.getStatus()).toBe(503);
  });

  it('reads PENDING → VERIFIED from GET /sessions/:id', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(json(200, { sessionStatus: 'PENDING' }))
      .mockResolvedValueOnce(json(200, { sessionStatus: 'VERIFIED' }));
    const c = live();
    expect(await c.getStatus('s1')).toBe('PENDING');
    expect(await c.getStatus('s1')).toBe('VERIFIED');
  });

  it('reads EXPIRED', async () => {
    global.fetch = jest.fn().mockResolvedValue(json(200, { sessionStatus: 'EXPIRED' }));
    expect(await live().getStatus('s1')).toBe('EXPIRED');
  });

  it('without a key (and not fake) refuses with 503 instead of calling out', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const err = await new VerifyMnClient(config({})).createSession('99112233', '1').catch((e) => e);
    expect(err.getStatus()).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('fake mode', () => {
    const fake = () => new VerifyMnClient(config({ VERIFY_MN_FAKE: 'true' }));

    it('turns VERIFIED 3 s after the session starts, without the network', async () => {
      jest.useFakeTimers();
      global.fetch = jest.fn();
      const c = fake();
      const s = await c.createSession('99112233', '482916');
      expect(await c.getStatus(s.sessionId)).toBe('PENDING');
      jest.advanceTimersByTime(3_000);
      expect(await c.getStatus(s.sessionId)).toBe('VERIFIED');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('refuses to boot in production', () => {
      const c = new VerifyMnClient(config({ VERIFY_MN_FAKE: 'true', NODE_ENV: 'production' }));
      expect(() => c.onModuleInit()).toThrow(/VERIFY_MN_FAKE/);
    });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd backend && npx jest src/auth/phone/verify-mn.client.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// backend/src/auth/phone/verify-mn.client.ts
import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { phoneError } from './phone';

/**
 * verify.mn — Mongolian MO-SMS verification (https://verify.mn).
 *
 * The USER texts a code from their own phone to 144773; verify.mn matches the
 * sender number + text and flips the session to VERIFIED. We never send SMS.
 *
 * - No callback: verify.mn's callback is unsigned, so we poll instead.
 * - `GET /sessions/:id` needs no auth, so a session id must never reach the app.
 * - The API key is never logged.
 */
const API = 'https://api.verify.mn';
const TIMEOUT_MS = 5_000;
/** Fake mode: a session verifies itself this long after it starts. */
const FAKE_DELAY_MS = 3_000;
const FAKE_TTL_MS = 300_000;

export interface VerifyMnSession {
  sessionId: string;
  smsUri: string;
  displayInstruction: string;
  expiresAt: string;
}

export type VerifyMnStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED';

/** 409 — a session with the same phone + text is still active. Retry with a new code. */
export class VerifyMnConflictError extends Error {}

const unavailable = () =>
  phoneError(
    HttpStatus.SERVICE_UNAVAILABLE,
    'SMS_UNAVAILABLE',
    'SMS баталгаажуулалт түр ажиллахгүй байна. Түр хүлээгээд дахин оролдоно уу.',
  );

@Injectable()
export class VerifyMnClient implements OnModuleInit {
  private readonly logger = new Logger(VerifyMnClient.name);

  constructor(private readonly config: ConfigService) {}

  /** Dev/Expo Go only: verify every session after 3 s without a key or an SMS. */
  private get fake(): boolean {
    return this.config.get<string>('VERIFY_MN_FAKE') === 'true';
  }

  private get apiKey(): string {
    return this.config.get<string>('VERIFY_MN_API_KEY') ?? '';
  }

  onModuleInit(): void {
    // Fail closed: fake mode in production would let anyone "own" any number.
    if (this.fake && this.config.get<string>('NODE_ENV') === 'production') {
      throw new Error('VERIFY_MN_FAKE=true is not allowed in production');
    }
    if (!this.fake && !this.apiKey) {
      this.logger.warn('VERIFY_MN_API_KEY is not set — phone verification will answer 503');
    }
  }

  async createSession(phone: string, code: string): Promise<VerifyMnSession> {
    if (this.fake) return fakeSession(phone, code);
    if (!this.apiKey) throw unavailable();

    const res = await this.call('/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ phone, text: code }),
    });
    if (res.status === 409) throw new VerifyMnConflictError();
    if (res.status === 401) {
      this.logger.error('verify.mn rejected the API key (401) — check VERIFY_MN_API_KEY');
      throw unavailable();
    }
    if (!res.ok) throw unavailable();

    const body = (await res.json()) as VerifyMnSession;
    return {
      sessionId: body.sessionId,
      smsUri: body.smsUri,
      displayInstruction: body.displayInstruction,
      expiresAt: body.expiresAt,
    };
  }

  async getStatus(sessionId: string): Promise<VerifyMnStatus> {
    if (this.fake) return fakeStatus(sessionId);
    const res = await this.call(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'GET' });
    if (!res.ok) throw unavailable();
    const body = (await res.json()) as { sessionStatus: VerifyMnStatus };
    return body.sessionStatus;
  }

  private async call(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(API + path, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      this.logger.warn(`verify.mn unreachable: ${err instanceof Error ? err.message : String(err)}`);
      throw unavailable();
    }
  }
}

function fakeSession(phone: string, code: string): VerifyMnSession {
  const now = Date.now();
  return {
    sessionId: `fake-${now}`,
    smsUri: `sms:144773?body=${code}`,
    displayInstruction: `Та өөрийн ${phone} дугаараас 144773 дугаарт "${code}" гэж SMS илгээнэ үү. (Хөгжүүлэлтийн горим — 3 секундын дараа автоматаар баталгаажна.)`,
    expiresAt: new Date(now + FAKE_TTL_MS).toISOString(),
  };
}

function fakeStatus(sessionId: string): VerifyMnStatus {
  const started = Number(sessionId.replace('fake-', ''));
  return Date.now() - started >= FAKE_DELAY_MS ? 'VERIFIED' : 'PENDING';
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd backend && npx jest src/auth/phone/verify-mn.client.spec.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/phone/verify-mn.client.ts backend/src/auth/phone/verify-mn.client.spec.ts
git commit -m "feat(auth): verify.mn client (fake горим + production хамгаалалт)"
```

---

### Task A3: Phone verification service (Redis records + single-use proofs)

**Files:**
- Create: `backend/src/auth/phone/test/fake-redis.ts`
- Create: `backend/src/auth/phone/phone-verification.service.ts`
- Test: `backend/src/auth/phone/phone-verification.service.spec.ts`

- [ ] **Step 1: Write the in-memory Redis used by the tests**

```ts
// backend/src/auth/phone/test/fake-redis.ts
/** Just the ioredis surface PhoneVerificationService uses. TTLs are ignored. */
export class FakeRedis {
  store = new Map<string, string>();

  async get(k: string) { return this.store.get(k) ?? null; }
  async set(k: string, v: string) { this.store.set(k, v); return 'OK'; }
  async del(...ks: string[]) { let n = 0; for (const k of ks) if (this.store.delete(k)) n++; return n; }
  async exists(k: string) { return this.store.has(k) ? 1 : 0; }
  async getdel(k: string) { const v = this.store.get(k) ?? null; this.store.delete(k); return v; }
  async incr(k: string) { const n = Number(this.store.get(k) ?? 0) + 1; this.store.set(k, String(n)); return n; }
  async expire() { return 1; }
}
```

- [ ] **Step 2: Write the failing test**

```ts
// backend/src/auth/phone/phone-verification.service.spec.ts
import { HttpException } from '@nestjs/common';
import { PhoneVerificationService } from './phone-verification.service';
import { VerifyMnConflictError, type VerifyMnClient } from './verify-mn.client';
import { FakeRedis } from './test/fake-redis';

const session = (id = 'vm-1') => ({
  sessionId: id,
  smsUri: 'sms:144773?body=123456',
  displayInstruction: 'Та өөрийн 99112233 дугаараас …',
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
});

function setup() {
  const redis = new FakeRedis();
  const vm = {
    createSession: jest.fn().mockResolvedValue(session()),
    getStatus: jest.fn().mockResolvedValue('PENDING'),
  };
  const svc = new PhoneVerificationService(vm as unknown as VerifyMnClient, redis as never);
  return { svc, vm, redis };
}

const codeOf = (err: unknown) => ((err as HttpException).getResponse() as { code: string }).code;

describe('PhoneVerificationService', () => {
  it('start() returns OUR id, never the verify.mn session id', async () => {
    const { svc } = setup();
    const r = await svc.start('99112233', 'register');
    expect(r.verificationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(r)).not.toContain('vm-1');
    expect(r).toMatchObject({ smsUri: 'sms:144773?body=123456' });
  });

  it('sends a fresh 6-digit code each time', async () => {
    const { svc, vm } = setup();
    await svc.start('99112233', 'register');
    await svc.start('99112233', 'register');
    const [a, b] = vm.createSession.mock.calls.map((c) => c[1]);
    expect(a).toMatch(/^\d{6}$/);
    expect(b).toMatch(/^\d{6}$/);
  });

  it('retries once with a new code on verify.mn 409', async () => {
    const { svc, vm } = setup();
    vm.createSession.mockRejectedValueOnce(new VerifyMnConflictError()).mockResolvedValueOnce(session());
    await svc.start('99112233', 'register');
    expect(vm.createSession).toHaveBeenCalledTimes(2);
  });

  it('allows 3 sessions per phone, then 429', async () => {
    const { svc } = setup();
    for (let i = 0; i < 3; i++) await svc.start('99112233', 'login');
    const err = await svc.start('99112233', 'login').catch((e) => e);
    expect((err as HttpException).getStatus()).toBe(429);
    expect(codeOf(err)).toBe('TOO_MANY_REQUESTS');
  });

  it('status: pending → verified, and stays verified on re-poll', async () => {
    const { svc, vm } = setup();
    const { verificationId } = await svc.start('99112233', 'register');
    expect(await svc.status(verificationId)).toEqual({ status: 'pending' });
    vm.getStatus.mockResolvedValue('VERIFIED');
    expect(await svc.status(verificationId)).toEqual({ status: 'verified' });
    expect(await svc.status(verificationId)).toEqual({ status: 'verified' });
    expect(vm.getStatus).toHaveBeenCalledTimes(2); // the 3rd poll is answered from Redis
  });

  it('status: EXPIRED and unknown ids are "expired"', async () => {
    const { svc, vm } = setup();
    const { verificationId } = await svc.start('99112233', 'register');
    vm.getStatus.mockResolvedValue('EXPIRED');
    expect(await svc.status(verificationId)).toEqual({ status: 'expired' });
    expect(await svc.status('00000000-0000-0000-0000-000000000000')).toEqual({ status: 'expired' });
  });

  it('consume() returns the proof exactly once', async () => {
    const { svc, vm } = setup();
    const { verificationId } = await svc.start('99112233', 'register');
    vm.getStatus.mockResolvedValue('VERIFIED');
    await svc.status(verificationId);

    await expect(svc.consume(verificationId, 'register')).resolves.toEqual({
      phone: '99112233',
      purpose: 'register',
      userId: null,
    });
    const again = await svc.consume(verificationId, 'register').catch((e) => e);
    expect(codeOf(again)).toBe('VERIFICATION_EXPIRED');
  });

  it('a register proof cannot be spent as a reset proof', async () => {
    const { svc, vm } = setup();
    const { verificationId } = await svc.start('99112233', 'register');
    vm.getStatus.mockResolvedValue('VERIFIED');
    await svc.status(verificationId);
    const err = await svc.consume(verificationId, 'reset').catch((e) => e);
    expect(codeOf(err)).toBe('VERIFICATION_INVALID');
  });

  it('consume() before the SMS arrived is VERIFICATION_INVALID', async () => {
    const { svc } = setup();
    const { verificationId } = await svc.start('99112233', 'login');
    const err = await svc.consume(verificationId, 'login').catch((e) => e);
    expect(codeOf(err)).toBe('VERIFICATION_INVALID');
  });

  it('link proofs carry the user id they were started for', async () => {
    const { svc, vm } = setup();
    const { verificationId } = await svc.start('99112233', 'link', 'user-1');
    vm.getStatus.mockResolvedValue('VERIFIED');
    await svc.status(verificationId);
    await expect(svc.consume(verificationId, 'link')).resolves.toMatchObject({ userId: 'user-1' });
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `cd backend && npx jest src/auth/phone/phone-verification.service.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

```ts
// backend/src/auth/phone/phone-verification.service.ts
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomInt, randomUUID } from 'crypto';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { phoneError } from './phone';
import { VerifyMnClient, VerifyMnConflictError } from './verify-mn.client';

export type PhonePurpose = 'register' | 'login' | 'reset' | 'link';

/** What a consumer endpoint gets after the SMS arrived. Single use. */
export interface PhoneProof {
  phone: string;
  purpose: PhonePurpose;
  /** Set for `link` only — the account the number is being attached to. */
  userId: string | null;
}

export interface PhoneStartResult {
  verificationId: string;
  smsUri: string;
  displayInstruction: string;
  expiresAt: string;
}

interface PendingRecord extends PhoneProof {
  vmSessionId: string;
}

/** A verified proof stays spendable this long (the user still has to type a password etc.). */
const PROOF_TTL_SECONDS = 600;
/** Max sessions per phone per window — each SMS costs the user 150₮. */
const RATE_MAX = 3;
const RATE_WINDOW_SECONDS = 600;

const pendingKey = (id: string) => `phonever:pending:${id}`;
const proofKey = (id: string) => `phonever:proof:${id}`;
const rateKey = (phone: string) => `phonever:rate:${phone}`;

/**
 * Two Redis keys per verification:
 * - `pending` — while we wait for the SMS. Holds the verify.mn session id,
 *   which never leaves the server (verify.mn's status endpoint has no auth).
 * - `proof` — written when verify.mn says VERIFIED. Bound to phone + purpose,
 *   spent with GETDEL so two parallel requests can never both use it.
 */
@Injectable()
export class PhoneVerificationService {
  constructor(
    private readonly vm: VerifyMnClient,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async start(phone: string, purpose: PhonePurpose, userId: string | null = null): Promise<PhoneStartResult> {
    await this.rateLimit(phone);
    const session = await this.createSession(phone);

    const verificationId = randomUUID();
    const record: PendingRecord = { phone, purpose, userId, vmSessionId: session.sessionId };
    const ttl = Math.max(1, Math.ceil((Date.parse(session.expiresAt) - Date.now()) / 1000));
    await this.redis.set(pendingKey(verificationId), JSON.stringify(record), 'EX', ttl);

    return {
      verificationId,
      smsUri: session.smsUri,
      displayInstruction: session.displayInstruction,
      expiresAt: session.expiresAt,
    };
  }

  async status(verificationId: string): Promise<{ status: 'pending' | 'verified' | 'expired' }> {
    if (await this.redis.exists(proofKey(verificationId))) return { status: 'verified' };

    const raw = await this.redis.get(pendingKey(verificationId));
    if (!raw) return { status: 'expired' };
    const record = JSON.parse(raw) as PendingRecord;

    const vmStatus = await this.vm.getStatus(record.vmSessionId);
    if (vmStatus === 'VERIFIED') {
      const proof: PhoneProof = { phone: record.phone, purpose: record.purpose, userId: record.userId };
      await this.redis.set(proofKey(verificationId), JSON.stringify(proof), 'EX', PROOF_TTL_SECONDS);
      await this.redis.del(pendingKey(verificationId));
      return { status: 'verified' };
    }
    if (vmStatus === 'EXPIRED') {
      await this.redis.del(pendingKey(verificationId));
      return { status: 'expired' };
    }
    return { status: 'pending' };
  }

  /** Spend a proof. Throws unless it exists, is verified and has this purpose. */
  async consume(verificationId: string, purpose: PhonePurpose): Promise<PhoneProof> {
    const raw = await this.redis.getdel(proofKey(verificationId));
    if (!raw) {
      // Still waiting for the SMS → the client called too early.
      if (await this.redis.exists(pendingKey(verificationId))) throw invalid();
      throw phoneError(
        HttpStatus.BAD_REQUEST,
        'VERIFICATION_EXPIRED',
        'Баталгаажуулалтын хугацаа дууссан. Дахин эхлүүлнэ үү.',
      );
    }
    const proof = JSON.parse(raw) as PhoneProof;
    if (proof.purpose !== purpose) throw invalid();
    return proof;
  }

  private async createSession(phone: string) {
    try {
      return await this.vm.createSession(phone, newCode());
    } catch (err) {
      // 409 = same phone + same text still active; a new code is a new text.
      if (err instanceof VerifyMnConflictError) return this.vm.createSession(phone, newCode());
      throw err;
    }
  }

  private async rateLimit(phone: string): Promise<void> {
    const n = await this.redis.incr(rateKey(phone));
    if (n === 1) await this.redis.expire(rateKey(phone), RATE_WINDOW_SECONDS);
    if (n > RATE_MAX) {
      throw phoneError(
        HttpStatus.TOO_MANY_REQUESTS,
        'TOO_MANY_REQUESTS',
        'Хэт олон оролдлого. 10 минутын дараа дахин оролдоно уу.',
      );
    }
  }
}

function newCode(): string {
  return String(randomInt(100000, 1_000_000));
}

function invalid() {
  return phoneError(HttpStatus.BAD_REQUEST, 'VERIFICATION_INVALID', 'Утас баталгаажаагүй байна.');
}
```

- [ ] **Step 5: Run it to see it pass**

Run: `cd backend && npx jest src/auth/phone/`
Expected: PASS (all three phone suites).

- [ ] **Step 6: Commit**

```bash
git add backend/src/auth/phone/
git commit -m "feat(auth): утас баталгаажуулалтын service — нэг удаагийн proof, rate limit"
```

---

### Task A4: Data model — nullable email, `phone_verified_at`, unique verified phone

**Files:**
- Create: `backend/src/migrations/1788200000000-AddPhoneVerification.ts`
- Modify: `backend/src/entities/user.entity.ts:31-33` and next to `phone` (line ~71)
- Modify: `backend/src/users/users.service.ts` (`create` + new phone helpers)

- [ ] **Step 1: Entity**

In `backend/src/entities/user.entity.ts` replace the email column:

```ts
  /**
   * Optional since phone sign-up (2026-10). Unique when present (NULLs don't
   * collide). Never verified for phone-registered accounts — only an address
   * with `emailVerified = true` may be used to log in, reset or link social.
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  email: string | null;
```

Replace the `phone` doc comment + column and add `phoneVerifiedAt` under it:

```ts
  /**
   * Mongolian mobile, normalised to 8 digits (`auth/phone/phone.ts`). Written
   * ONLY by the verify.mn flow (and cleared by an admin). Never trust it as an
   * identity unless `phoneVerifiedAt` is set — every lookup checks that.
   */
  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  /** When the phone was proven by an SMS to 144773. NULL = not verified. */
  @Column({ name: 'phone_verified_at', type: 'timestamptz', nullable: true })
  phoneVerifiedAt: Date | null;
```

Add a class-level partial unique index on the entity (next to `@Entity('users')`):

```ts
@Entity('users')
@Index('UQ_users_verified_phone', ['phone'], { unique: true, where: '"phone_verified_at" IS NOT NULL' })
export class User extends BaseEntity {
```

- [ ] **Step 2: Migration**

```ts
// backend/src/migrations/1788200000000-AddPhoneVerification.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phone sign-up (verify.mn) — spec 2026-10-13.
 *
 * - `email` becomes optional (phone-registered accounts may have none).
 * - `phone_verified_at` marks a phone proven by SMS.
 * - One verified phone = one account: partial unique index. Unverified legacy
 *   `phone` values (nothing writes them today) never block anyone.
 *
 * Down refuses to run while any account has no email (it would fail anyway on
 * SET NOT NULL — this just says why).
 */
export class AddPhoneVerification1788200000000 implements MigrationInterface {
  name = 'AddPhoneVerification1788200000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_verified_at" TIMESTAMPTZ NULL`);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_verified_phone" ON "users" ("phone") WHERE "phone_verified_at" IS NOT NULL`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    const [{ n }] = await q.query(`SELECT COUNT(*)::int AS n FROM "users" WHERE "email" IS NULL`);
    if (n > 0) throw new Error(`${n} account(s) have no email — cannot restore NOT NULL`);
    await q.query(`DROP INDEX IF EXISTS "UQ_users_verified_phone"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "phone_verified_at"`);
    await q.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`);
  }
}
```

Check how migrations are registered: `grep -n "migrations" backend/src/config/typeorm.config.ts`. If it is a glob (`migrations/*.{ts,js}`) nothing else is needed; if it is an explicit array, append `AddPhoneVerification1788200000000` there.

- [ ] **Step 3: UsersService**

In `backend/src/users/users.service.ts`, change `create`'s parameter `email: string;` to `email: string | null;` and `phone?: string | null;` stays. Add `phoneVerifiedAt?: Date | null;` to that parameter object. Then add these methods after `setPasswordHash`:

```ts
  /** The account holding this VERIFIED phone (input must be normalised). */
  findByVerifiedPhone(phone: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('u')
      .where('u.phone = :phone AND u.phone_verified_at IS NOT NULL', { phone })
      .getOne();
  }

  /** True when another account already holds this verified phone. */
  async isPhoneTaken(phone: string, excludeUserId?: string): Promise<boolean> {
    const q = this.users
      .createQueryBuilder('u')
      .where('u.phone = :phone AND u.phone_verified_at IS NOT NULL', { phone });
    if (excludeUserId) q.andWhere('u.id != :excludeUserId', { excludeUserId });
    return (await q.getCount()) > 0;
  }

  /** True when `username` is free (case-insensitive, same rule as assertUsernameFree). */
  async isUsernameFree(username: string): Promise<boolean> {
    try {
      await this.assertUsernameFree(username);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Attach a phone proven by SMS. A parallel claim of the same number loses on
   * the partial unique index (23505) — the caller maps that to PHONE_TAKEN.
   */
  async setVerifiedPhone(id: string, phone: string): Promise<void> {
    await this.users.update(id, { phone, phoneVerifiedAt: new Date() });
  }

  /** Admin: release a number (operator recycled it to someone else). */
  async clearPhone(id: string): Promise<void> {
    const res = await this.users.update(id, { phone: null, phoneVerifiedAt: null });
    if (!res.affected) throw new NotFoundException('Хэрэглэгч олдсонгүй');
  }
```

- [ ] **Step 4: Build to surface every `email` null-site**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: errors in `auth.service.ts`, `jwt.strategy.ts`-consumers, `account-deletion.service.ts`, `social-auth.service.ts` (and maybe others) — **these are fixed in Task A5; do not commit yet if you want a green tree, or commit with the note below.**

- [ ] **Step 5: Commit (entity + migration + users helpers)**

```bash
git add backend/src/entities/user.entity.ts backend/src/migrations/1788200000000-AddPhoneVerification.ts backend/src/users/users.service.ts
git commit -m "feat(db): email nullable, phone_verified_at, баталгаажсан утас unique (migration)"
```

---

### Task A5: Nullable email everywhere + `needsPhone` in the public user

**Files:**
- Modify: `backend/src/auth/strategies/jwt.strategy.ts:11`
- Modify: `backend/src/auth/auth.service.ts` (PublicUser, toPublicUser, buildAuthResult, register's Redis keys)
- Modify: `backend/src/auth/auth.controller.ts:116-120`
- Modify: `backend/src/auth/social/social-auth.service.ts` (await buildAuthResult)
- Modify: `backend/src/users/account-deletion.service.ts` (`clearRedis`)

- [ ] **Step 1: JwtPayload**

`backend/src/auth/strategies/jwt.strategy.ts`: change `email: string;` → `email: string | null;`.

- [ ] **Step 2: PublicUser + async buildAuthResult**

In `backend/src/auth/auth.service.ts`:

Change the `PublicUser` interface's `email: string;` to `email: string | null;` and add three fields at the end:

```ts
  /** Normalised 8-digit phone, or null. Only meaningful when phoneVerified. */
  phone: string | null;
  phoneVerified: boolean;
  /**
   * True → the app must show the phone gate. Email/password accounts without a
   * verified phone; never Google/Apple accounts (Apple 5.1.1 — don't force a
   * phone on Sign in with Apple users). The ONE source of truth for the gate.
   */
  needsPhone: boolean;
```

Inject the identities repo into `AuthService` (the repo is already registered in `AuthModule` via `TypeOrmModule.forFeature([UserIdentity])`):

```ts
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserIdentity } from '../entities/user-identity.entity';
// constructor — add as the last parameter:
    @InjectRepository(UserIdentity)
    private readonly identities: Repository<UserIdentity>,
```

Replace `buildAuthResult` and `toPublicUser` with:

```ts
  /** Public so social sign-in returns the exact same session shape. */
  async buildAuthResult(user: User): Promise<AuthResult> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return { accessToken: this.jwtService.sign(payload), user: await this.publicUser(user) };
  }

  /** `toPublicUser` + the gate flag (needs one identities lookup). */
  async publicUser(user: User): Promise<PublicUser> {
    const phoneVerified = user.phoneVerifiedAt !== null;
    const needsPhone = !phoneVerified && (await this.identities.count({ where: { userId: user.id } })) === 0;
    return this.toPublicUser(user, needsPhone);
  }

  /** Maps a User entity to the public shape (drops passwordHash, relations). */
  toPublicUser(user: User, needsPhone = false): PublicUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      xp: user.xp,
      sparks: user.sparks,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      level: user.level,
      province: user.province,
      district: user.district,
      phone: user.phoneVerifiedAt ? user.phone : null,
      phoneVerified: user.phoneVerifiedAt !== null,
      needsPhone,
    };
  }
```

Update every `return this.buildAuthResult(user);` inside `auth.service.ts` (in `verifyOtp` and `login`) — they are already in `async` functions returning `Promise<AuthResult>`, so `return this.buildAuthResult(user)` keeps working (it returns a promise). No change needed beyond confirming they are `return`ed.

In `register`, the legacy email path: `user.email` is now `string | null` but this path always creates with `dto.email`, so use the DTO value instead of `user.email` everywhere in `register` (`this.referralKey(dto.email)`, `this.tasteKey(dto.email)`, `this.sendOtp('verify', dto.email)`, the two log lines, and `return { pendingVerification: true, email: dto.email }`).

In `login`'s `ForbiddenException` body, `email: user.email` stays (nullable is fine for JSON).

- [ ] **Step 3: Controller `me`**

`backend/src/auth/auth.controller.ts`:

```ts
  /** Return the current user (+ `needsPhone`). Requires a valid Bearer token. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return this.authService.publicUser(user);
  }
```

- [ ] **Step 4: Social service awaits**

`backend/src/auth/social/social-auth.service.ts` — the three spread sites become:

```ts
      return { needsUsername: false, ...(await this.authService.buildAuthResult(user)) };
```

(the `existing` identity branch and the `byEmail` branch) and the two `return this.authService.buildAuthResult(...)` in `completeSignUp` stay as `return` (async function). `claims.email` in `SignupTicket` keeps type `string`.

- [ ] **Step 5: Account deletion**

In `backend/src/users/account-deletion.service.ts`, find `private async clearRedis(userId: string, email: string)` and change the parameter to `email: string | null`. Inside, guard every email-keyed delete:

```ts
    if (email) {
      // existing email-keyed key deletions stay here unchanged
    }
```

- [ ] **Step 6: Type-check and run the whole suite**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json && npm test`
Expected: tsc exits 0; jest all green. If tsc lists another `email` site (e.g. a mail call or a promo log), make it null-safe the same way: skip the email-only side effect when `email` is null; for display strings use `user.email ?? user.username`.

- [ ] **Step 7: Commit**

```bash
git add -A backend/src
git commit -m "feat(auth): email nullable болсонд зохицуулж, public user-д phone/needsPhone нэмэв"
```

---

### Task A6: Close the unverified-email holes (social linking + email reset)

**Files:**
- Modify: `backend/src/auth/social/social-auth.service.ts` (signIn step 2, completeSignUp adopt)
- Modify: `backend/src/auth/auth.service.ts` (`forgotPassword`, `resetPassword`)
- Test: `backend/src/auth/social/social-auth.service.spec.ts`, `backend/src/auth/auth-phone.spec.ts` (email-reset part)

- [ ] **Step 1: Write the failing social regression test**

```ts
// backend/src/auth/social/social-auth.service.spec.ts
import { SocialAuthService } from './social-auth.service';
import { AuthProvider } from '../../common/enums';

/**
 * An address typed at sign-up is no longer verified (phone sign-up keeps email
 * optional and unverified). If Google/Apple sign-in still linked to ANY account
 * with that address, an attacker could pre-register with the victim's email and
 * receive the victim's later Google sign-in. Only verified addresses may link.
 */
function setup(byEmail: { id: string; emailVerified: boolean } | null) {
  const identities = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
    create: jest.fn((x) => x),
  };
  const tokens = {
    verify: jest.fn().mockResolvedValue({
      provider: AuthProvider.GOOGLE,
      sub: 'g-1',
      email: 'victim@gmail.com',
      emailVerified: true,
      fullName: 'Victim',
    }),
  };
  const usersService = {
    findByEmail: jest.fn().mockResolvedValue(byEmail),
    markEmailVerified: jest.fn(),
    assertUsernameFree: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };
  const authService = { buildAuthResult: jest.fn().mockResolvedValue({ accessToken: 't', user: {} }) };
  const jwtService = { sign: jest.fn().mockReturnValue('ticket'), verify: jest.fn() };
  const svc = new SocialAuthService(
    identities as never,
    tokens as never,
    usersService as never,
    authService as never,
    jwtService as never,
  );
  return { svc, identities, usersService, authService };
}

describe('SocialAuthService — linking by email', () => {
  it('links to an account whose email IS verified', async () => {
    const { svc, identities } = setup({ id: 'u-1', emailVerified: true });
    const res = await svc.signIn(AuthProvider.GOOGLE, 'id-token');
    expect(res).toMatchObject({ needsUsername: false });
    expect(identities.save).toHaveBeenCalled();
  });

  it('does NOT link to (or verify) an account whose email is unverified', async () => {
    const { svc, identities, usersService } = setup({ id: 'attacker', emailVerified: false });
    const res = await svc.signIn(AuthProvider.GOOGLE, 'id-token');
    expect(res).toMatchObject({ needsUsername: true });
    expect(identities.save).not.toHaveBeenCalled();
    expect(usersService.markEmailVerified).not.toHaveBeenCalled();
  });
});
```

Before writing it, open `social-auth.service.ts` and confirm the `signIn` "new person" branch returns `{ needsUsername: true, ticket, … }` and the `SocialProfile` field names (`fullName` may be named differently — use the real name from `social-token.service.ts`).

- [ ] **Step 2: Run it to see it fail**

Run: `cd backend && npx jest src/auth/social/social-auth.service.spec.ts`
Expected: the "does NOT link" test FAILS (current code links and marks verified).

- [ ] **Step 3: Fix `signIn` step 2**

Replace the step-2 block with:

```ts
    // 2 — same VERIFIED address as an existing account: link, don't duplicate.
    // Only verified: an unverified address may have been typed by anyone
    // (phone sign-up keeps email optional and unverified), and linking to it
    // would hand the provider's owner over to whoever typed it.
    if (profile.emailVerified) {
      const byEmail = await this.usersService.findByEmail(profile.email);
      if (byEmail?.emailVerified) {
        await this.link(byEmail.id, profile);
        return { needsUsername: false, ...(await this.authService.buildAuthResult(byEmail)) };
      }
    }
```

- [ ] **Step 4: Fix `completeSignUp` adopt**

Replace the "adopt" block and the create call's `email`:

```ts
    // Someone may have registered this address in the meantime. Adopt it only
    // if they VERIFIED it; an unverified holder keeps it, and the new social
    // account starts without an email (the unique index forbids a duplicate).
    const existing = await this.usersService.findByEmail(claims.email);
    if (existing?.emailVerified) {
      await this.link(existing.id, { ...claims, provider: claims.provider });
      return this.authService.buildAuthResult(existing);
    }

    const user = await this.usersService.create({
      email: existing ? null : claims.email,
```

- [ ] **Step 5: Verified-only email reset**

In `auth.service.ts`:

```ts
  /** Start password recovery: email a reset code. Always "ok" (no user leak). */
  async forgotPassword(email: string): Promise<{ ok: true }> {
    const user = await this.usersService.findByEmail(email);
    // Only a VERIFIED address: an unverified one may belong to someone else
    // (phone sign-up stores email unverified) — sending them a reset code
    // would hand over the account.
    if (user?.emailVerified) await this.sendOtp('reset', email);
    return { ok: true };
  }
```

and in `resetPassword` change `if (!user)` to `if (!user || !user.emailVerified)`.

- [ ] **Step 6: Run tests**

Run: `cd backend && npx jest src/auth/social/social-auth.service.spec.ts && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/auth/social/ backend/src/auth/auth.service.ts
git commit -m "fix(auth): баталгаажаагүй имэйлтэй дансанд social холбох, имэйлээр сэргээхийг хаав"
```

---

### Task A7: Auth phone flows (register / login / reset / link / login-by-phone)

**Files:**
- Modify: `backend/src/auth/auth.service.ts`
- Test: `backend/src/auth/auth-phone.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// backend/src/auth/auth-phone.spec.ts
import { HttpException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

const codeOf = (e: unknown) => ((e as HttpException).getResponse() as { code?: string }).code;

function userRow(over: Record<string, unknown> = {}) {
  return {
    id: 'u-1', email: null, username: 'bataa_07', fullName: 'Батбаяр', role: 'student',
    xp: 0, sparks: 0, emailVerified: false, avatarUrl: null, level: null, province: null,
    district: null, phone: '99112233', phoneVerifiedAt: new Date(), passwordHash: null, ...over,
  };
}

function setup() {
  const usersService = {
    findByUsernameOrEmail: jest.fn().mockResolvedValue(null),
    findByVerifiedPhone: jest.fn().mockResolvedValue(null),
    isPhoneTaken: jest.fn().mockResolvedValue(false),
    findByEmail: jest.fn().mockResolvedValue(null),
    assertUsernameFree: jest.fn(),
    create: jest.fn(async (d) => userRow({ ...d, id: 'new' })),
    setPasswordHash: jest.fn(),
    setVerifiedPhone: jest.fn(),
    findById: jest.fn(async () => userRow()),
  };
  const phone = { consume: jest.fn() };
  const referrals = { applyReferralOnVerify: jest.fn() };
  const xp = { awardOnce: jest.fn(), rewards: jest.fn().mockResolvedValue({ onboarding: 10 }) };
  const identities = { count: jest.fn().mockResolvedValue(0) };
  const jwt = { sign: jest.fn().mockReturnValue('jwt') };
  const svc = new AuthService(
    usersService as never, jwt as never, {} as never, referrals as never, xp as never,
    {} as never /* redis — unused by phone flows */, identities as never, phone as never,
  );
  return { svc, usersService, phone, referrals, xp };
}

describe('AuthService — phone flows', () => {
  it('registerWithPhone creates a verified-phone account and logs in', async () => {
    const { svc, usersService, phone } = setup();
    phone.consume.mockResolvedValue({ phone: '99112233', purpose: 'register', userId: null });

    const res = await svc.registerWithPhone({
      verificationId: 'v', username: 'bataa_07', password: 'secret1', fullName: 'Батбаяр',
    });

    expect(phone.consume).toHaveBeenCalledWith('v', 'register');
    const created = usersService.create.mock.calls[0][0];
    expect(created).toMatchObject({ phone: '99112233', email: null, emailVerified: false });
    expect(created.phoneVerifiedAt).toBeInstanceOf(Date);
    expect(res.accessToken).toBe('jwt');
    expect(res.user.needsPhone).toBe(false);
  });

  it('registerWithPhone grants referral + onboarding XP once', async () => {
    const { svc, phone, referrals, xp } = setup();
    phone.consume.mockResolvedValue({ phone: '99112233', purpose: 'register', userId: null });
    await svc.registerWithPhone({
      verificationId: 'v', username: 'bataa_07', password: 'secret1', fullName: 'Б',
      referralCode: 'SPARK-7K2Q', tasteCompleted: true,
    });
    expect(referrals.applyReferralOnVerify).toHaveBeenCalledWith(expect.anything(), 'SPARK-7K2Q');
    expect(xp.awardOnce).toHaveBeenCalledWith(expect.objectContaining({ amount: 10 }));
  });

  it('registerWithPhone → 409 PHONE_TAKEN when the number has an account', async () => {
    const { svc, usersService, phone } = setup();
    phone.consume.mockResolvedValue({ phone: '99112233', purpose: 'register', userId: null });
    usersService.isPhoneTaken.mockResolvedValue(true);
    const err = await svc
      .registerWithPhone({ verificationId: 'v', username: 'x_1', password: 'secret1', fullName: 'Б' })
      .catch((e) => e);
    expect(err.getStatus()).toBe(409);
    expect(codeOf(err)).toBe('PHONE_TAKEN');
  });

  it('registerWithPhone → 409 PHONE_TAKEN when the unique index loses a race', async () => {
    const { svc, usersService, phone } = setup();
    phone.consume.mockResolvedValue({ phone: '99112233', purpose: 'register', userId: null });
    usersService.create.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505', detail: 'Key (phone)=(99112233)' }));
    const err = await svc
      .registerWithPhone({ verificationId: 'v', username: 'x_1', password: 'secret1', fullName: 'Б' })
      .catch((e) => e);
    expect(codeOf(err)).toBe('PHONE_TAKEN');
  });

  it('registerWithPhone → 409 EMAIL_TAKEN when the optional email is used', async () => {
    const { svc, usersService, phone } = setup();
    phone.consume.mockResolvedValue({ phone: '99112233', purpose: 'register', userId: null });
    usersService.findByEmail.mockResolvedValue(userRow({ id: 'other' }));
    const err = await svc
      .registerWithPhone({ verificationId: 'v', username: 'x_1', password: 'secret1', fullName: 'Б', email: 'a@b.mn' })
      .catch((e) => e);
    expect(codeOf(err)).toBe('EMAIL_TAKEN');
  });

  it('loginWithPhone logs into the account with that verified phone', async () => {
    const { svc, usersService, phone } = setup();
    phone.consume.mockResolvedValue({ phone: '99112233', purpose: 'login', userId: null });
    usersService.findByVerifiedPhone.mockResolvedValue(userRow());
    const res = await svc.loginWithPhone('v');
    expect(res.user.id).toBe('u-1');
  });

  it('resetWithPhone sets the new password and logs in', async () => {
    const { svc, usersService, phone } = setup();
    phone.consume.mockResolvedValue({ phone: '99112233', purpose: 'reset', userId: null });
    usersService.findByVerifiedPhone.mockResolvedValue(userRow());
    await svc.resetWithPhone('v', 'newpass1');
    const [id, hash] = usersService.setPasswordHash.mock.calls[0];
    expect(id).toBe('u-1');
    expect(await bcrypt.compare('newpass1', hash)).toBe(true);
  });

  it('linkPhone refuses a proof started by another user', async () => {
    const { svc, phone } = setup();
    phone.consume.mockResolvedValue({ phone: '99112233', purpose: 'link', userId: 'someone-else' });
    const err = await svc.linkPhone(userRow({ id: 'u-1', phoneVerifiedAt: null }) as never, 'v').catch((e) => e);
    expect(codeOf(err)).toBe('VERIFICATION_INVALID');
  });

  it('linkPhone attaches the number to the caller', async () => {
    const { svc, usersService, phone } = setup();
    phone.consume.mockResolvedValue({ phone: '99112233', purpose: 'link', userId: 'u-1' });
    await svc.linkPhone(userRow({ id: 'u-1', phoneVerifiedAt: null }) as never, 'v');
    expect(usersService.setVerifiedPhone).toHaveBeenCalledWith('u-1', '99112233');
  });

  it('login accepts a verified phone as identifier', async () => {
    const { svc, usersService } = setup();
    const hash = await bcrypt.hash('secret1', 4);
    usersService.findByVerifiedPhone.mockResolvedValue(userRow({ passwordHash: hash }));
    const res = await svc.login({ identifier: '9911 2233', password: 'secret1' });
    expect(usersService.findByVerifiedPhone).toHaveBeenCalledWith('99112233');
    expect(res.user.id).toBe('u-1');
  });

  it('a phone-registered account without a verified email is NOT blocked by EMAIL_NOT_VERIFIED', async () => {
    const { svc, usersService } = setup();
    const hash = await bcrypt.hash('secret1', 4);
    usersService.findByUsernameOrEmail.mockResolvedValue(userRow({ passwordHash: hash }));
    await expect(svc.login({ identifier: 'bataa_07', password: 'secret1' })).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd backend && npx jest src/auth/auth-phone.spec.ts`
Expected: FAIL — `registerWithPhone is not a function` (and constructor arity).

- [ ] **Step 3: Implement in `auth.service.ts`**

Add imports:

```ts
import { HttpStatus } from '@nestjs/common';
import { PhoneVerificationService } from './phone/phone-verification.service';
import { normalizePhone, phoneError, tryNormalizePhone } from './phone/phone';
import type { RegisterPhoneDto } from './phone/dto/phone.dto';
```

Constructor — add as the LAST parameter (after `identities`):

```ts
    private readonly phone: PhoneVerificationService,
```

Extract the post-verification bonuses from `verifyOtp` into one private method used by both flows (DRY). Replace the two `if (firstVerification) { try { … } }` referral/taste blocks in `verifyOtp` with:

```ts
    if (firstVerification) {
      await this.grantSignupBonuses(user, {
        referralCode: await this.takeRedis(this.referralKey(email)),
        tasteCompleted: (await this.takeRedis(this.tasteKey(email))) !== null,
      });
    }
```

and add:

```ts
  /** Read-and-delete a pending Redis value (referral / taste markers). */
  private async takeRedis(key: string): Promise<string | null> {
    const value = await this.redis.get(key);
    if (value !== null) await this.redis.del(key);
    return value;
  }

  /**
   * One-time rewards for a brand-new, verified account: the inviter's referral
   * and the pre-signup taste-task XP. Guarded — a reward hiccup must never
   * block the sign-up itself.
   */
  private async grantSignupBonuses(
    user: User,
    opts: { referralCode?: string | null; tasteCompleted?: boolean },
  ): Promise<void> {
    if (opts.referralCode) {
      try {
        await this.referrals.applyReferralOnVerify(user, opts.referralCode);
      } catch (err) {
        this.logger.warn(`Referral apply failed for ${user.id}: ${String(err)}`);
      }
    }
    if (opts.tasteCompleted) {
      try {
        await this.xp.awardOnce({
          userId: user.id,
          amount: (await this.xp.rewards()).onboarding,
          source: XpSource.ONBOARDING,
          referenceId: user.id,
        });
      } catch (err) {
        this.logger.warn(`Onboarding bonus failed for ${user.id}: ${String(err)}`);
      }
    }
  }
```

Add the phone flows:

```ts
  // ── Phone (verify.mn) ───────────────────────────────────────────────────

  /** SMS-before check so nobody pays 150₮ to learn their username is taken. */
  async checkAvailability(username?: string, phone?: string): Promise<{ username?: boolean; phone?: boolean }> {
    const out: { username?: boolean; phone?: boolean } = {};
    if (username) out.username = await this.usersService.isUsernameFree(username.trim());
    if (phone) out.phone = !(await this.usersService.isPhoneTaken(normalizePhone(phone)));
    return out;
  }

  /** Start a public verification. register: number must be free; login/reset: must exist. */
  async startPhone(rawPhone: string, purpose: 'register' | 'login' | 'reset') {
    const phone = normalizePhone(rawPhone);
    const taken = await this.usersService.isPhoneTaken(phone);
    if (purpose === 'register' && taken) throw phoneTaken();
    if (purpose !== 'register' && !taken) {
      throw phoneError(HttpStatus.NOT_FOUND, 'PHONE_NOT_FOUND', 'Энэ дугаараар бүртгэл олдсонгүй.');
    }
    return this.phone.start(phone, purpose);
  }

  /** Start linking a phone to the logged-in account. */
  async startLinkPhone(user: User, rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    if (await this.usersService.isPhoneTaken(phone, user.id)) throw phoneTaken();
    return this.phone.start(phone, 'link', user.id);
  }

  /** Create an account whose phone is already proven → logged in. */
  async registerWithPhone(dto: RegisterPhoneDto): Promise<AuthResult> {
    // Cheap checks first, so a failure doesn't burn the user's proof.
    await this.usersService.assertUsernameFree(dto.username);
    const email = dto.email?.trim() || null;
    if (email && (await this.usersService.findByEmail(email))) {
      throw phoneError(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'Энэ имэйл өөр дансанд бүртгэлтэй. Хоосон орхиж болно.');
    }

    const proof = await this.phone.consume(dto.verificationId, 'register');
    if (await this.usersService.isPhoneTaken(proof.phone)) throw phoneTaken();

    let user: User;
    try {
      user = await this.usersService.create({
        email,
        username: dto.username.trim(),
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        fullName: dto.fullName.trim(),
        emailVerified: false,
        phone: proof.phone,
        phoneVerifiedAt: new Date(),
        level: dto.level ?? null,
        province: dto.province ?? null,
        district: dto.district ?? null,
      });
    } catch (err) {
      throw mapUniqueViolation(err);
    }

    await this.grantSignupBonuses(user, {
      referralCode: dto.referralCode?.trim() || null,
      tasteCompleted: dto.tasteCompleted,
    });
    return this.buildAuthResult(user);
  }

  /** «SMS-ээр нэвтрэх» — no password. */
  async loginWithPhone(verificationId: string): Promise<AuthResult> {
    const proof = await this.phone.consume(verificationId, 'login');
    return this.buildAuthResult(await this.accountForPhone(proof.phone));
  }

  /** Reset by phone, then log straight in. */
  async resetWithPhone(verificationId: string, password: string): Promise<AuthResult> {
    const proof = await this.phone.consume(verificationId, 'reset');
    const user = await this.accountForPhone(proof.phone);
    await this.usersService.setPasswordHash(user.id, await bcrypt.hash(password, BCRYPT_ROUNDS));
    return this.buildAuthResult(user);
  }

  /** Attach a proven phone to the caller. Returns the refreshed public user. */
  async linkPhone(caller: User, verificationId: string): Promise<PublicUser> {
    const proof = await this.phone.consume(verificationId, 'link');
    // The proof must have been started BY this account — otherwise anyone who
    // learned a verificationId could attach that number to themselves.
    if (proof.userId !== caller.id) {
      throw phoneError(HttpStatus.BAD_REQUEST, 'VERIFICATION_INVALID', 'Утас баталгаажаагүй байна.');
    }
    try {
      await this.usersService.setVerifiedPhone(caller.id, proof.phone);
    } catch (err) {
      throw mapUniqueViolation(err);
    }
    const fresh = await this.usersService.findById(caller.id);
    return this.publicUser(fresh!);
  }

  private async accountForPhone(phone: string): Promise<User> {
    const user = await this.usersService.findByVerifiedPhone(phone);
    if (!user) throw phoneError(HttpStatus.NOT_FOUND, 'PHONE_NOT_FOUND', 'Энэ дугаараар бүртгэл олдсонгүй.');
    return user;
  }
```

And at module level (below the class or above it):

```ts
function phoneTaken() {
  return phoneError(HttpStatus.CONFLICT, 'PHONE_TAKEN', 'Энэ дугаар өөр дансанд бүртгэлтэй байна.');
}

/** Postgres 23505 on the verified-phone index → PHONE_TAKEN; anything else rethrown. */
function mapUniqueViolation(err: unknown): unknown {
  const e = err as { code?: string; detail?: string };
  if (e.code === '23505' && (e.detail ?? '').includes('phone')) return phoneTaken();
  return err;
}
```

Change `login` — identifier lookup and the email gate:

```ts
  /** Verify credentials (username, email or verified phone) and return a fresh token. */
  async login(dto: LoginDto): Promise<AuthResult> {
    const identifier = (dto.identifier ?? dto.email ?? '').trim();
    const phone = tryNormalizePhone(identifier);
    const user = !identifier
      ? null
      : phone
        ? await this.usersService.findByVerifiedPhone(phone)
        : await this.usersService.findByUsernameOrEmail(identifier);
```

(keep the existing password check unchanged) and change the email gate condition from `if (!user.emailVerified) {` to:

```ts
    // A phone-verified account is verified — its email (if any) is optional.
    if (!user.emailVerified && !user.phoneVerifiedAt) {
```

Note: a username that is exactly 8 digits starting 5–9 would be treated as a phone. `isValidUsername` / `@IsUsername()` — check `backend/src/common/validation/username.ts`; if purely-numeric usernames are allowed, fall back: when `phone` is set and no account has that phone, also try `findByUsernameOrEmail(identifier)`:

```ts
        ? (await this.usersService.findByVerifiedPhone(phone)) ??
          (await this.usersService.findByUsernameOrEmail(identifier))
```

Use this fallback form unconditionally — it is one extra query only on a miss.

- [ ] **Step 4: Create the DTO file the service imports**

```ts
// backend/src/auth/phone/dto/phone.dto.ts
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { MN_PROVINCES } from '../../../common/enums';
import { IsUsername } from '../../../common/validation/username';

/** POST /auth/phone/start */
export class StartPhoneDto {
  @IsString()
  @MaxLength(20)
  phone: string;

  @IsIn(['register', 'login', 'reset'])
  purpose: 'register' | 'login' | 'reset';
}

/** POST /users/me/phone/start */
export class StartLinkPhoneDto {
  @IsString()
  @MaxLength(20)
  phone: string;
}

/** Any consumer that only needs the proof. */
export class VerificationIdDto {
  @IsUUID()
  verificationId: string;
}

/** POST /auth/phone/reset */
export class PhoneResetDto extends VerificationIdDto {
  @IsString()
  @MinLength(6, { message: 'Нууц үг дор хаяж 6 тэмдэгт байх ёстой' })
  @MaxLength(72, { message: 'Нууц үг хэт урт байна' })
  password: string;
}

/** POST /auth/register-phone — RegisterDto minus email-required, plus the proof. */
export class RegisterPhoneDto extends VerificationIdDto {
  @IsUsername()
  username: string;

  @IsString()
  @MinLength(6, { message: 'Нууц үг дор хаяж 6 тэмдэгт байх ёстой' })
  @MaxLength(72, { message: 'Нууц үг хэт урт байна' })
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  /** Optional and NOT verified (spec decision 1). */
  @IsOptional()
  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  level?: string;

  @IsOptional()
  @IsIn([...MN_PROVINCES], { message: 'Аймаг/хот буруу байна' })
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  referralCode?: string;

  @IsOptional()
  @IsBoolean()
  tasteCompleted?: boolean;
}

/** GET /auth/check-availability */
export class CheckAvailabilityDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
```

- [ ] **Step 5: Run tests**

Run: `cd backend && npx jest src/auth/ && npx tsc --noEmit -p tsconfig.json`
Expected: PASS; tsc exits 0.

- [ ] **Step 6: Commit**

```bash
git add backend/src/auth/
git commit -m "feat(auth): утсаар бүртгэл, нэвтрэлт, нууц үг сэргээх, утас холбох"
```

---

### Task A8: Routes + module wiring + admin unlink

**Files:**
- Create: `backend/src/auth/phone/phone.controller.ts`
- Modify: `backend/src/auth/auth.module.ts`

- [ ] **Step 1: Controller**

```ts
// backend/src/auth/phone/phone.controller.ts
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../common/enums';
import { UsersService } from '../../users/users.service';
import { PhoneVerificationService } from './phone-verification.service';
import {
  CheckAvailabilityDto, PhoneResetDto, RegisterPhoneDto, StartLinkPhoneDto, StartPhoneDto, VerificationIdDto,
} from './dto/phone.dto';

/** Each session start makes the user spend 150₮ on an SMS — keep it tight. */
const SESSION_START = { default: { limit: 5, ttl: 60_000 } };
/** Same credential limit as /auth/login. */
const STRICT = { default: { limit: 5, ttl: 60_000 } };
/** The app polls every 3 s for up to 5 min ≈ 100 calls; leave headroom. */
const POLL = { default: { limit: 40, ttl: 60_000 } };

/**
 * Every phone route (spec 2026-10-13). Full paths on purpose: the link/admin
 * routes live under /users but need AuthService, and UsersModule must not
 * import AuthModule back.
 */
@Controller()
export class PhoneController {
  constructor(
    private readonly auth: AuthService,
    private readonly phone: PhoneVerificationService,
    private readonly users: UsersService,
  ) {}

  @Throttle(SESSION_START)
  @Get('auth/check-availability')
  checkAvailability(@Query() q: CheckAvailabilityDto) {
    return this.auth.checkAvailability(q.username, q.phone);
  }

  @Throttle(SESSION_START)
  @Post('auth/phone/start')
  @HttpCode(200)
  start(@Body() dto: StartPhoneDto) {
    return this.auth.startPhone(dto.phone, dto.purpose);
  }

  @Throttle(POLL)
  @Get('auth/phone/status/:verificationId')
  status(@Param('verificationId', ParseUUIDPipe) id: string) {
    return this.phone.status(id);
  }

  @Throttle(STRICT)
  @Post('auth/register-phone')
  registerPhone(@Body() dto: RegisterPhoneDto) {
    return this.auth.registerWithPhone(dto);
  }

  @Throttle(STRICT)
  @Post('auth/phone/login')
  @HttpCode(200)
  login(@Body() dto: VerificationIdDto) {
    return this.auth.loginWithPhone(dto.verificationId);
  }

  @Throttle(STRICT)
  @Post('auth/phone/reset')
  @HttpCode(200)
  reset(@Body() dto: PhoneResetDto) {
    return this.auth.resetWithPhone(dto.verificationId, dto.password);
  }

  @Throttle(SESSION_START)
  @UseGuards(JwtAuthGuard)
  @Post('users/me/phone/start')
  @HttpCode(200)
  startLink(@CurrentUser() user: User, @Body() dto: StartLinkPhoneDto) {
    return this.auth.startLinkPhone(user, dto.phone);
  }

  @UseGuards(JwtAuthGuard)
  @Post('users/me/phone')
  @HttpCode(200)
  link(@CurrentUser() user: User, @Body() dto: VerificationIdDto) {
    return this.auth.linkPhone(user, dto.verificationId);
  }

  /** Admin: release a recycled number. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Delete('users/:id/phone')
  async unlink(@Param('id', ParseUUIDPipe) id: string) {
    await this.users.clearPhone(id);
    return { ok: true };
  }
}
```

Before using them, confirm the guard/decorator import paths exist: `ls backend/src/auth/guards backend/src/auth/decorators` (UsersController imports `RolesGuard` from `../auth/guards/roles.guard` and `Roles` from `../auth/decorators/roles.decorator` — same files).

- [ ] **Step 2: Module**

In `backend/src/auth/auth.module.ts` add imports and register:

```ts
import { PhoneController } from './phone/phone.controller';
import { PhoneVerificationService } from './phone/phone-verification.service';
import { VerifyMnClient } from './phone/verify-mn.client';
// …
  controllers: [AuthController, PhoneController],
  providers: [AuthService, JwtStrategy, SocialTokenService, SocialAuthService, VerifyMnClient, PhoneVerificationService],
```

`ConfigModule` is global in `AppModule` (check `isGlobal: true` in `app.module.ts`); if not, add `ConfigModule` to this module's `imports`.

- [ ] **Step 3: Boot + smoke test locally (fake mode)**

Add to your local `backend/.env`: `VERIFY_MN_FAKE=true`. Then:

```bash
cd backend && npm run start:dev
# other terminal:
V=$(curl -s -X POST localhost:3000/api/auth/phone/start -H 'Content-Type: application/json' \
  -d '{"phone":"99112233","purpose":"register"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).verificationId')
curl -s localhost:3000/api/auth/phone/status/$V; sleep 4; curl -s localhost:3000/api/auth/phone/status/$V
curl -s -X POST localhost:3000/api/auth/register-phone -H 'Content-Type: application/json' \
  -d "{\"verificationId\":\"$V\",\"username\":\"phone_test1\",\"password\":\"secret1\",\"fullName\":\"Тест\"}"
```

Expected: `{"status":"pending"}`, then `{"status":"verified"}`, then a JSON with `accessToken` and `"needsPhone":false,"phoneVerified":true`. Running the register call a second time → `400 VERIFICATION_EXPIRED`. (Local dev runs `DB_SYNCHRONIZE=true`, so the new column already exists; the migration is exercised in Step 4.)

- [ ] **Step 4: Migration up/down on a scratch DB**

```bash
psql -d postgres -c "DROP DATABASE IF EXISTS sparkxp_migtest;" -c "CREATE DATABASE sparkxp_migtest OWNER postgres;"
psql -d sparkxp_migtest -c "CREATE TABLE users (id uuid PRIMARY KEY, email varchar NOT NULL, phone varchar NULL);"
cd backend && DB_NAME=sparkxp_migtest npx ts-node -r tsconfig-paths/register -e "
import { AddPhoneVerification1788200000000 as M } from './src/migrations/1788200000000-AddPhoneVerification';
import { DataSource } from 'typeorm';
(async () => {
  const ds = new DataSource({ type: 'postgres', host: 'localhost', username: 'postgres', password: 'postgres', database: 'sparkxp_migtest' });
  await ds.initialize(); const q = ds.createQueryRunner();
  await new M().up(q); console.log('up ok'); await new M().down(q); console.log('down ok'); await new M().up(q); console.log('up again ok');
  await ds.destroy();
})();"
psql -d postgres -c "DROP DATABASE sparkxp_migtest;"
```

Expected: `up ok`, `down ok`, `up again ok`.

- [ ] **Step 5: Full suite + build**

Run: `cd backend && npm test && npm run build`
Expected: green; build exits 0.

- [ ] **Step 6: Commit**

```bash
git add backend/src/auth/
git commit -m "feat(auth): утасны route-ууд (start/status/register/login/reset/link + admin салгах)"
```

---

### Task A9: Env + API docs

**Files:**
- Modify: `backend/.env.example`, `API.md`

- [ ] **Step 1: `.env.example`** — add a block:

```
# ── Phone verification (verify.mn, MO-SMS to 144773) ─────────────────────────
# API key from the verify.mn Developer Console. Empty → phone routes answer 503.
VERIFY_MN_API_KEY=
# Dev/Expo Go only: every session verifies itself after 3 s (no SMS, no key).
# The server REFUSES to boot with this in production.
VERIFY_MN_FAKE=false
```

- [ ] **Step 2: `API.md` §1 (Auth)** — add rows for every route in the A8 controller (path · auth · purpose · body), the error-code table from the spec §7, and a note under the existing login row: "`identifier` нь утас (8 орон) байж болно". In the mobile usage map add `src/api/phone.ts` → screens `register`, `phone-login`, `forgot`, `phone-link`, `account`. In the admin map add `DELETE /users/:id/phone` → `UsersPage`.

- [ ] **Step 3: Commit + push**

```bash
git add backend/.env.example API.md
git commit -m "docs(api): утас баталгаажуулалтын endpoint-ууд + env"
git push origin usukhbayar
```

---

# PART B — Admin

### Task B1: Verified badge + «Утас салгах»

**Files:**
- Modify: `admin/src/pages/users/UsersPage.tsx`

- [ ] **Step 1: Type** — in the `User` type (line ~16-18) add `phoneVerifiedAt: string | null;` and change `email: string;` to `email: string | null;`.

- [ ] **Step 2: Unlink handler** — next to the existing delete handler (line ~80):

```tsx
  const unlinkPhone = async (u: User) => {
    if (!confirm(`${u.username ?? u.fullName}-ийн ${u.phone} дугаарыг салгах уу? Тэр хүн дахин SMS-ээр баталгаажуулах шаардлагатай болно.`)) return;
    await api.delete(`/users/${u.id}/phone`);
    await load(); // use the page's existing reload function name
  };
```

(Open the file and use whatever the page already calls to refetch after `api.delete(`/users/${u.id}`)`.)

- [ ] **Step 3: Render** — replace the phone `<span>` (line ~97-101) with:

```tsx
            {u.phone && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Phone className="h-3 w-3" />{u.phone}
                {u.phoneVerifiedAt ? (
                  <span title="SMS-ээр баталгаажсан" className="text-emerald-600">✓</span>
                ) : (
                  <span title="Баталгаажаагүй" className="text-gray-400">(баталгаажаагүй)</span>
                )}
                {u.phoneVerifiedAt && (
                  <button onClick={() => unlinkPhone(u)} className="ml-1 text-red-500 hover:underline">салгах</button>
                )}
              </span>
            )}
```

and change `<p className="text-xs text-gray-400">{u.email}</p>` to `{u.email && <p className="text-xs text-gray-400">{u.email}</p>}`. In the delete confirm use `${u.email ?? u.username ?? u.fullName}`.

- [ ] **Step 4: Build**

Run: `cd admin && npm run build`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add admin/src/pages/users/UsersPage.tsx
git commit -m "feat(admin): утас баталгаажсан тэмдэг + утас салгах"
```

---

# PART C — Mobile

> Run the app with `cd mobile && npm run go` against a local backend that has `VERIFY_MN_FAKE=true` — every verification completes 3 s after «SMS илгээх» without a real SMS.

### Task C1: API layer + types

**Files:**
- Modify: `mobile/src/api/auth.ts`
- Create: `mobile/src/api/phone.ts`

- [ ] **Step 1: `AuthUser`** — in `mobile/src/api/auth.ts` change `email: string;` to `email: string | null;` and add:

```ts
  phone: string | null;
  phoneVerified: boolean;
  /** Server says: show the phone gate (email accounts without a verified phone). */
  needsPhone: boolean;
```

- [ ] **Step 2: `src/api/phone.ts`**

```ts
// mobile/src/api/phone.ts
import { apiRequest } from './client';
import type { AuthResult, AuthUser } from './auth';

/** What a verification needs on screen. `verificationId` is ours, not verify.mn's. */
export interface PhoneSession {
  verificationId: string;
  smsUri: string;
  displayInstruction: string;
  expiresAt: string;
}

export type PhoneStatus = 'pending' | 'verified' | 'expired';
export type PublicPurpose = 'register' | 'login' | 'reset';

/** SMS-before check so nobody pays 150₮ to learn their username is taken. */
export function checkAvailability(q: { username?: string; phone?: string }) {
  const params = new URLSearchParams();
  if (q.username) params.set('username', q.username);
  if (q.phone) params.set('phone', q.phone);
  return apiRequest<{ username?: boolean; phone?: boolean }>(`/auth/check-availability?${params}`);
}

export function startPhoneVerification(phone: string, purpose: PublicPurpose) {
  return apiRequest<PhoneSession>('/auth/phone/start', { method: 'POST', body: { phone, purpose } });
}

/** Logged-in variant (purpose = link). */
export function startLinkPhone(phone: string, token: string) {
  return apiRequest<PhoneSession>('/users/me/phone/start', { method: 'POST', body: { phone }, token });
}

export function getPhoneStatus(verificationId: string) {
  return apiRequest<{ status: PhoneStatus }>(`/auth/phone/status/${verificationId}`);
}

export interface RegisterPhonePayload {
  verificationId: string;
  username: string;
  password: string;
  fullName: string;
  email?: string;
  level?: string;
  province?: string;
  district?: string;
  referralCode?: string;
  tasteCompleted?: boolean;
}

export function registerWithPhone(payload: RegisterPhonePayload) {
  return apiRequest<AuthResult>('/auth/register-phone', { method: 'POST', body: payload });
}

export function loginWithPhone(verificationId: string) {
  return apiRequest<AuthResult>('/auth/phone/login', { method: 'POST', body: { verificationId } });
}

export function resetWithPhone(verificationId: string, password: string) {
  return apiRequest<AuthResult>('/auth/phone/reset', { method: 'POST', body: { verificationId, password } });
}

export function linkPhone(verificationId: string, token: string) {
  return apiRequest<AuthUser>('/users/me/phone', { method: 'POST', body: { verificationId }, token });
}
```

Before writing, open `mobile/src/api/client.ts` and confirm the `apiRequest` option names (`method`, `body`, `token`) — `src/api/promos.ts` is a good example of a token-authenticated call; match it exactly.

- [ ] **Step 3: Type-check**

Run: `cd mobile && npx tsc --noEmit`
Expected: errors only where `user.email` is used as a `string` (e.g. `app/account.tsx` `value={user?.email ?? ''}` is already safe). Fix any others with `?? ''`.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/api/
git commit -m "feat(mobile): утас баталгаажуулалтын API + AuthUser талбарууд"
```

---

### Task C2: SMS URI + polling hook

**Files:**
- Create: `mobile/src/lib/smsUri.ts`
- Create: `mobile/src/lib/usePhoneVerification.ts`

- [ ] **Step 1: `smsUri.ts`**

```ts
// mobile/src/lib/smsUri.ts
import { Platform } from 'react-native';

/**
 * verify.mn returns `sms:144773?body=…` (the Android form). iOS Messages only
 * pre-fills the body with `&body=`. Built per platform from the server's URI so
 * the shortcode and text stay whatever verify.mn said. Check both on a real
 * phone — simulators cannot send SMS.
 */
export function platformSmsUri(serverUri: string): string {
  const match = /^sms:([^?&]+)[?&]body=(.*)$/.exec(serverUri);
  if (!match) return serverUri;
  const [, number, body] = match;
  return Platform.OS === 'ios' ? `sms:${number}&body=${body}` : `sms:${number}?body=${body}`;
}

/** The 6-digit code inside the URI (shown big in the card). */
export function codeFromSmsUri(serverUri: string): string {
  const match = /body=([^&]*)/.exec(serverUri);
  return match ? decodeURIComponent(match[1]) : '';
}
```

- [ ] **Step 2: `usePhoneVerification.ts`**

```ts
// mobile/src/lib/usePhoneVerification.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPhoneStatus, type PhoneSession } from '../api/phone';
import { ApiError } from '../api/client';

export type VerifyState = 'idle' | 'starting' | 'waiting' | 'verified' | 'expired';

/** verify.mn asks for ≥3 s between polls — SMS delivery is not sub-second. */
const POLL_MS = 3_000;

/**
 * One phone verification: start it with any `start*` API call, then this polls
 * our backend until verified / expired. Stops polling the moment it is verified
 * (every extra SMS costs the user 150₮) and on unmount.
 *
 *   const v = usePhoneVerification();
 *   await v.start(() => startPhoneVerification(phone, 'login'));
 *   useEffect(() => { if (v.state === 'verified') loginWithPhone(v.verificationId!) }, [v.state]);
 */
export function usePhoneVerification() {
  const [session, setSession] = useState<PhoneSession | null>(null);
  const [state, setState] = useState<VerifyState>('idle');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  const start = useCallback(async (begin: () => Promise<PhoneSession>) => {
    setError(null);
    setState('starting');
    try {
      const s = await begin();
      if (!alive.current) return;
      setSession(s);
      setState('waiting');
    } catch (e) {
      if (!alive.current) return;
      setState('idle');
      setError(e instanceof ApiError ? e : new ApiError(0, String(e)));
      throw e;
    }
  }, []);

  // Poll + countdown while waiting.
  useEffect(() => {
    if (state !== 'waiting' || !session) return;
    const deadline = Date.parse(session.expiresAt);
    const tick = () => setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    tick();
    const clock = setInterval(tick, 1_000);
    const poll = setInterval(async () => {
      if (Date.now() >= deadline) {
        setState('expired');
        return;
      }
      try {
        const { status } = await getPhoneStatus(session.verificationId);
        if (!alive.current) return;
        if (status === 'verified') setState('verified');
        else if (status === 'expired') setState('expired');
      } catch {
        // Network blip: keep polling until the deadline — no error on screen.
      }
    }, POLL_MS);
    return () => {
      clearInterval(clock);
      clearInterval(poll);
    };
  }, [state, session]);

  const reset = useCallback(() => {
    setSession(null);
    setState('idle');
    setError(null);
  }, []);

  return {
    state,
    session,
    verificationId: session?.verificationId ?? null,
    secondsLeft,
    error,
    start,
    reset,
  };
}

export type PhoneVerification = ReturnType<typeof usePhoneVerification>;
```

- [ ] **Step 3: Type-check + commit**

```bash
cd mobile && npx tsc --noEmit
git add mobile/src/lib/smsUri.ts mobile/src/lib/usePhoneVerification.ts
git commit -m "feat(mobile): SMS URI туслах + утас баталгаажуулалтын polling hook"
```

---

### Task C3: i18n keys

**Files:**
- Modify: `mobile/src/i18n/index.ts` (both the Mongolian dict near `otpTitle` line ~164 and the English dict near line ~1467)

- [ ] **Step 1: Add to the Mongolian dict**

```ts
  phone: 'Утасны дугаар',
  phoneHint: 'Энэ дугаараасаа нэг SMS илгээж баталгаажуулна.',
  emailOptional: 'Имэйл (заавал биш)',
  usernamePhoneOrEmail: 'Нэвтрэх нэр, утас эсвэл имэйл',
  phoneVerifyTitle: 'Утсаа баталгаажуулах',
  phoneVerifyBody: 'Доорх кодыг өөрийн утаснаасаа SMS-ээр илгээхэд л болно.',
  phoneRecipient: 'Хүлээн авагч',
  phoneWaiting: 'Таны SMS-ийг хүлээж байна',
  phoneVerified: 'Хүлээн авлаа, дугаар баталгаажлаа',
  phoneExpired: 'Энэ кодын хугацаа дууссан',
  phoneExpiredBody: '5 минутын дотор SMS ирсэнгүй. Шинэ код аваад дахин илгээнэ үү. Хуучин кодыг илгээвэл тооцогдохгүй.',
  phoneSendSms: 'SMS илгээх',
  phoneSmsCost: 'Оператор SMS бүрд 150₮ тооцно.',
  phoneNewCode: 'Шинэ код авах',
  phoneChange: 'Дугаараа солих',
  phoneCreatingAccount: 'Данс үүсгэж байна…',
  phoneTaken: 'Энэ дугаар өөр дансанд бүртгэлтэй байна. Нэвтрэх эсвэл нууц үгээ сэргээнэ үү.',
  phoneNotFound: 'Энэ дугаараар бүртгэл олдсонгүй.',
  usernameTaken: 'Энэ нэвтрэх нэр аль хэдийн бүртгэлтэй байна.',
  emailTaken: 'Энэ имэйл өөр дансанд бүртгэлтэй. Хоосон орхиж болно.',
  phoneLogin: 'SMS-ээр нэвтрэх',
  phoneLoginHint: 'Нууц үггүй, утасныхаа нэг SMS-ээр орно.',
  phoneLoginTitle: 'SMS-ээр нэвтрэх',
  phoneLoginBody: 'Дансандаа холбосон дугаараа оруулна уу.',
  forgotPhoneBody: 'Дансандаа холбосон утасны дугаараа оруулна уу. Тэр дугаараас нэг SMS илгээгээд шинэ нууц үгээ тохируулна.',
  forgotByEmail: 'Утас холбоогүй бол имэйлээр сэргээх',
  newPasswordTitle: 'Шинэ нууц үг',
  newPassword: 'Шинэ нууц үг',
  savePassword: 'Нууц үгээ хадгалах',
  phoneGateTitle: 'Утсаа нэг удаа баталгаажуулна уу',
  phoneGateBody: 'SparkXP одоо утасны дугаараар нууц үг сэргээдэг болсон. Дугаараа холбосноор дансаа хэзээ ч алдахгүй.',
  phoneLinkTitle: 'Утасны дугаар холбох',
  phoneLinkBody: 'Нууц үг сэргээх, вэбээр нэвтрэхэд хэрэгтэй.',
  verifyAction: 'Баталгаажуулах',
  signedInAs: 'нэрээр нэвтэрсэн',
  linkAction: 'Холбох',
  continueWithPhone: 'Утсаар бүртгүүлэх',
```

- [ ] **Step 2: Add the English twins** (same keys) in the English dict:

```ts
  phone: 'Phone number',
  phoneHint: 'You will verify it by sending one SMS from this number.',
  emailOptional: 'Email (optional)',
  usernamePhoneOrEmail: 'Username, phone or email',
  phoneVerifyTitle: 'Verify your phone',
  phoneVerifyBody: 'Just text the code below from your own phone.',
  phoneRecipient: 'To',
  phoneWaiting: 'Waiting for your SMS',
  phoneVerified: 'Received — number verified',
  phoneExpired: 'This code has expired',
  phoneExpiredBody: 'No SMS arrived within 5 minutes. Get a new code and send it again. The old code no longer counts.',
  phoneSendSms: 'Send SMS',
  phoneSmsCost: 'Your operator charges 150₮ per SMS.',
  phoneNewCode: 'Get a new code',
  phoneChange: 'Change number',
  phoneCreatingAccount: 'Creating your account…',
  phoneTaken: 'This number already has an account. Log in or reset your password.',
  phoneNotFound: 'No account uses this number.',
  usernameTaken: 'This username is already taken.',
  emailTaken: 'This email belongs to another account. You can leave it empty.',
  phoneLogin: 'Log in with SMS',
  phoneLoginHint: 'No password — one SMS from your phone.',
  phoneLoginTitle: 'Log in with SMS',
  phoneLoginBody: 'Enter the number linked to your account.',
  forgotPhoneBody: 'Enter the phone number linked to your account. Send one SMS from it, then set a new password.',
  forgotByEmail: 'No phone linked? Reset by email',
  newPasswordTitle: 'New password',
  newPassword: 'New password',
  savePassword: 'Save password',
  phoneGateTitle: 'Verify your phone once',
  phoneGateBody: 'SparkXP now resets passwords by phone. Link your number so you never lose your account.',
  phoneLinkTitle: 'Link a phone number',
  phoneLinkBody: 'Needed for password reset and web login.',
  verifyAction: 'Verify',
  signedInAs: 'signed in',
  linkAction: 'Link',
  continueWithPhone: 'Sign up with phone',
```

- [ ] **Step 3: Type-check + commit**

```bash
cd mobile && npx tsc --noEmit
git add mobile/src/i18n/index.ts
git commit -m "feat(mobile): утас баталгаажуулалтын i18n түлхүүрүүд"
```

---

### Task C4: `PhoneVerifyCard`

**Files:**
- Create: `mobile/src/components/PhoneVerifyCard.tsx`

Design reference: canvas artboard «PhoneVerifyCard (дундын)».

- [ ] **Step 1: Component**

```tsx
// mobile/src/components/PhoneVerifyCard.tsx
import { useMemo } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../settings/SettingsContext';
import { radius, spacing, type AppColors } from '../theme/theme';
import { t } from '../i18n';
import { AppText } from './Text';
import { Button } from './Button';
import { codeFromSmsUri, platformSmsUri } from '../lib/smsUri';
import type { PhoneVerification } from '../lib/usePhoneVerification';

/**
 * The SMS step shared by sign-up, SMS login, password reset, the phone gate and
 * phone linking. Shows the code as an outgoing message bubble to 144773, the
 * verify.mn instruction VERBATIM (it names the number the SMS must come from —
 * sending from another SIM is the #1 failure), and a one-tap «SMS илгээх».
 *
 * `onRestart` gets a fresh session (new code) after expiry.
 */
export function PhoneVerifyCard({
  verification,
  onRestart,
}: {
  verification: PhoneVerification;
  onRestart: () => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { state, session, secondsLeft } = verification;
  if (!session) return null;

  const code = codeFromSmsUri(session.smsUri);
  const waiting = state === 'waiting';
  const expired = state === 'expired';
  const verified = state === 'verified';
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="chatbubble-outline" size={20} color={c.glow} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" color={c.textMuted}>{t('phoneRecipient')}</AppText>
          <AppText variant="h3">144773</AppText>
        </View>
        {waiting ? <AppText variant="bodyStrong" color={c.textSecondary}>{`${mm}:${ss}`}</AppText> : null}
      </View>

      <View style={styles.bubbleRow}>
        {expired ? (
          <View style={[styles.bubble, styles.bubbleDead]}>
            <AppText style={[styles.code, styles.codeDead]}>{code}</AppText>
          </View>
        ) : (
          <LinearGradient colors={c.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubble}>
            <AppText style={styles.code}>{code}</AppText>
          </LinearGradient>
        )}
        <AppText
          variant="label"
          color={verified ? c.success : expired ? c.danger : c.textSecondary}
          accessibilityLiveRegion="polite"
        >
          {verified ? t('phoneVerified') : expired ? t('phoneExpired') : t('phoneWaiting')}
        </AppText>
      </View>

      {waiting ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(100, (secondsLeft / 300) * 100)}%` }]} />
        </View>
      ) : null}

      {waiting ? (
        <AppText variant="body" color={c.textSecondary}>{session.displayInstruction}</AppText>
      ) : expired ? (
        <AppText variant="body" color={c.textSecondary}>{t('phoneExpiredBody')}</AppText>
      ) : null}

      {waiting ? (
        <View style={{ gap: spacing.sm }}>
          <Button
            label={t('phoneSendSms')}
            icon="send"
            onPress={() => Linking.openURL(platformSmsUri(session.smsUri))}
          />
          <AppText variant="caption" center color={c.textMuted}>{t('phoneSmsCost')}</AppText>
        </View>
      ) : null}

      {expired ? <Button label={t('phoneNewCode')} icon="refresh" variant="secondary" onPress={onRestart} /> : null}
    </View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    card: {
      padding: spacing.lg,
      borderRadius: radius.xl,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      gap: spacing.md,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    avatar: {
      width: 44, height: 44, borderRadius: radius.full,
      backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center',
    },
    bubbleRow: { alignItems: 'flex-end', gap: spacing.xs },
    bubble: {
      paddingVertical: 14, paddingHorizontal: 22,
      borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 6,
    },
    bubbleDead: { backgroundColor: c.surfaceAlt, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong },
    code: {
      fontFamily: 'Manrope_800ExtraBold', fontSize: 34, lineHeight: 40, letterSpacing: 6,
      color: c.white, fontVariant: ['tabular-nums'],
    },
    codeDead: { color: c.lockedInk, textDecorationLine: 'line-through' },
    track: { height: 4, borderRadius: radius.full, backgroundColor: c.surfaceAlt, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: radius.full, backgroundColor: c.glow },
  });
```

Before writing, verify these exist and adjust names to the real ones (do not invent):
- `Button` props: `icon` (leading Ionicons name) and `variant="secondary"` — open `mobile/src/components/Button.tsx`.
- Theme tokens `c.glow`, `c.primarySoft`, `c.lockedInk`, `c.primaryGradient`, `c.white`, `radius.xl`, `radius.full`, `spacing.xs/sm/md/lg` — open `mobile/src/theme/theme.ts`.
- The Manrope 800 font family name registered in `app/_layout.tsx` `useFonts({...})`.

The progress bar uses verify.mn's fixed 300 s TTL.

- [ ] **Step 2: Type-check + commit**

```bash
cd mobile && npx tsc --noEmit
git add mobile/src/components/PhoneVerifyCard.tsx
git commit -m "feat(mobile): PhoneVerifyCard — SMS кодын бөмбөлөг, тоолуур, төлөвүүд"
```

---

### Task C5: Registration with phone

**Files:**
- Modify: `mobile/app/(auth)/register.tsx`
- Modify: `mobile/app/(auth)/onboarding/account.tsx`

- [ ] **Step 1: State + validation** — in `RegisterScreen`:

```ts
import * as phoneApi from '../../src/api/phone';
import { usePhoneVerification } from '../../src/lib/usePhoneVerification';
import { PhoneVerifyCard } from '../../src/components/PhoneVerifyCard';
import { ApiError } from '../../src/api/client';
```

- Change `type Step` to `'info' | 'location' | 'placement' | 'phone' | 'otp' | 'success'` (`otp` stays ONLY for the legacy `?verifyEmail=` resume path).
- Add `const [phone, setPhone] = useState('');` and `const verification = usePhoneVerification();`.
- Change `infoValid` to require the phone and NOT the email:

```ts
  const phoneOk = /^[5-9]\d{7}$/.test(phone.replace(/\D/g, ''));
  const infoValid = usernameOk && fullName.trim() && phoneOk && passOk && confirm === password;
```

- [ ] **Step 2: Fields** — in the `info` step, add the phone field right after the username field and turn the email field into the optional one:

```tsx
          <TextField
            leftIcon="call-outline"
            label={t('phone')}
            keyboardType="number-pad"
            maxLength={8}
            value={phone}
            onChangeText={setPhone}
            hint={t('phoneHint')}
          />
```

(If `TextField` has no `hint` prop — check `src/components/TextField.tsx` — render `<AppText variant="caption" color={colors.textMuted}>{t('phoneHint')}</AppText>` under it instead.)

Change the email field's `label={t('email')}` to `label={t('emailOptional')}`.

- [ ] **Step 3: Replace `submit` (placement → SMS)**

```ts
  /** Placement → check names are free (before the user pays for an SMS), then start the SMS step. */
  async function submit() {
    setError(null);
    const digits = phone.replace(/\D/g, '');
    const free = await phoneApi.checkAvailability({ username: username.trim(), phone: digits });
    if (free.username === false) throw new Error(t('usernameTaken'));
    if (free.phone === false) throw new Error(t('phoneTaken'));
    await verification.start(() => phoneApi.startPhoneVerification(digits, 'register'));
  }

  /** SMS arrived → create the account (already logged in) → success. */
  useEffect(() => {
    if (step !== 'phone' || verification.state !== 'verified' || !verification.verificationId) return;
    (async () => {
      try {
        const res = await phoneApi.registerWithPhone({
          verificationId: verification.verificationId!,
          username: username.trim(),
          password,
          fullName: fullName.trim(),
          email: email.trim() || undefined,
          level,
          province,
          district: isUB ? district : undefined,
          referralCode: referral ?? undefined,
          tasteCompleted: tasteDone || undefined,
        });
        if (referral) clearPendingReferral();
        if (tasteDone) clearTasteCompleted();
        await applyOnboardingGoal(res.accessToken);
        setResult(res);
        setStep('success');
      } catch (e) {
        const code = e instanceof ApiError ? e.code : undefined;
        setStep('info');
        verification.reset();
        fail(code === 'EMAIL_TAKEN' ? t('emailTaken') : code === 'PHONE_TAKEN' ? t('phoneTaken') : e instanceof Error ? e.message : t('errorGeneric'));
      }
    })();
  }, [step, verification.state]);
```

In the placement `ActionButton` change `onSuccess={() => setStep('otp')}` to `onSuccess={() => setStep('phone')}`.

Check: `verify()` (OTP) used to `setResult(res)` and something moved the wizard to `success`; find where (`useEffect` on `result` or in the OTP button's `onSuccess`) and keep the legacy OTP path working exactly as before.

- [ ] **Step 4: The `phone` step UI** — add a branch before the final OTP branch:

```tsx
      ) : step === 'phone' ? (
        <>
          <AppText variant="h1" center style={styles.title}>{t('phoneVerifyTitle')}</AppText>
          <AppText variant="body" center color={colors.textSecondary} style={styles.subtitle}>
            {verification.state === 'verified' ? t('phoneCreatingAccount') : t('phoneVerifyBody')}
          </AppText>
          <PhoneVerifyCard
            verification={verification}
            onRestart={() =>
              verification.start(() => phoneApi.startPhoneVerification(phone.replace(/\D/g, ''), 'register')).catch((e) => fail(e.message))
            }
          />
          <Button label={t('phoneChange')} variant="ghost" onPress={() => { verification.reset(); setStep('info'); }} style={styles.button} />
        </>
```

And in `back()`: `if (step === 'phone') { verification.reset(); setStep('placement'); }` before the other branches.

- [ ] **Step 5: Onboarding account option** — in `app/(auth)/onboarding/account.tsx` change the filled option to:

```tsx
        {/* The main path — phone sign-up (verify.mn SMS). */}
        <AuthOption
          icon="call"
          label={t('continueWithPhone')}
          filled
          onPress={() => leave('/(auth)/register', 'register')}
        />
```

- [ ] **Step 6: Manual test (Expo Go, backend in fake mode)**

1. Onboarding → «Утсаар бүртгүүлэх» → fill username/phone `99112233`/password → location → level → «Бүртгүүлэх».
2. Card shows the code bubble + `4:5x` countdown; after ~3 s the label turns green «Хүлээн авлаа…», subtitle «Данс үүсгэж байна…», then the success screen → «Эхлэх» lands on Home.
3. Repeat with the same phone → error «Энэ дугаар өөр дансанд бүртгэлтэй…» on the info step, no SMS card.

- [ ] **Step 7: Commit**

```bash
cd mobile && npx tsc --noEmit
git add "mobile/app/(auth)/register.tsx" "mobile/app/(auth)/onboarding/account.tsx"
git commit -m "feat(mobile): утсаар бүртгүүлэх (verify.mn SMS алхам)"
```

---

### Task C6: SMS login

**Files:**
- Create: `mobile/app/(auth)/phone-login.tsx`
- Modify: `mobile/src/components/SignInSheet.tsx`

- [ ] **Step 1: Screen**

```tsx
// mobile/app/(auth)/phone-login.tsx
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as phoneApi from '../../src/api/phone';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';
import { usePhoneVerification } from '../../src/lib/usePhoneVerification';
import { useColors } from '../../src/settings/SettingsContext';
import { spacing } from '../../src/theme/theme';
import { t } from '../../src/i18n';
import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { ActionButton } from '../../src/components/ActionButton';
import { FormError } from '../../src/components/FormError';
import { PhoneVerifyCard } from '../../src/components/PhoneVerifyCard';

/** «SMS-ээр нэвтрэх»: number → SMS → logged in. No password. */
export default function PhoneLoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const { applySession } = useAuth();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const v = usePhoneVerification();
  const digits = phone.replace(/\D/g, '');

  const begin = () => v.start(() => phoneApi.startPhoneVerification(digits, 'login'));

  useEffect(() => {
    if (v.state !== 'verified' || !v.verificationId) return;
    phoneApi
      .loginWithPhone(v.verificationId)
      .then(applySession) // RootNavigator then leaves (auth)
      .catch((e) => {
        v.reset();
        setError(e instanceof Error ? e.message : t('errorGeneric'));
      });
  }, [v.state]);

  return (
    <Screen>
      <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <AppText variant="h1" style={styles.title}>{t('phoneLoginTitle')}</AppText>
      <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>
        {v.session ? t('phoneVerifyBody') : t('phoneLoginBody')}
      </AppText>

      {v.session ? (
        <PhoneVerifyCard verification={v} onRestart={() => begin().catch(() => {})} />
      ) : (
        <>
          <TextField leftIcon="call-outline" label={t('phone')} keyboardType="number-pad" maxLength={8} value={phone} onChangeText={setPhone} />
          <FormError message={error} />
          <ActionButton
            label={t('continue')}
            action={begin}
            onError={(msg) => setError(msg)}
            disabled={!/^[5-9]\d{7}$/.test(digits)}
            style={styles.button}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  title: { marginTop: spacing.md },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.lg },
  button: { marginTop: spacing.md },
});
```

Confirm `ActionButton`'s `onError` signature in `src/components/ActionButton.tsx` (register.tsx passes `onError={fail}` where `fail(msg: string)`), and that `ApiError.message` already carries the backend's Mongolian message (it does — `client.ts` builds it from `message`). Remove the `ApiError` import if unused.

- [ ] **Step 2: Sign-in sheet** — in `src/components/SignInSheet.tsx`:
- Change the identifier field `label={t('usernameOrEmail')}` → `label={t('usernamePhoneOrEmail')}`.
- Under the login button / before the `orDivider`, add:

```tsx
          <Pressable onPress={() => { onClose(); router.push('/(auth)/phone-login'); }} hitSlop={8} style={styles.smsLink}>
            <Ionicons name="chatbubble-outline" size={18} color={colors.glow} />
            <AppText variant="bodyStrong" color={colors.glow}>{t('phoneLogin')}</AppText>
          </Pressable>
          <AppText variant="caption" center color={colors.textMuted}>{t('phoneLoginHint')}</AppText>
```

with `smsLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 44 }` in its styles (reuse the sheet's existing `router`/`onClose`; if it uses `router.push('/(auth)/forgot')` already, mirror that).

- [ ] **Step 3: Manual test** — Login sheet → «SMS-ээр нэвтрэх» → enter the phone registered in C5 → card → ~3 s → Home. Unknown number → «Энэ дугаараар бүртгэл олдсонгүй.»

- [ ] **Step 4: Commit**

```bash
cd mobile && npx tsc --noEmit
git add "mobile/app/(auth)/phone-login.tsx" mobile/src/components/SignInSheet.tsx
git commit -m "feat(mobile): SMS-ээр нэвтрэх"
```

---

### Task C7: Password reset by phone

**Files:**
- Modify: `mobile/app/(auth)/forgot.tsx`

- [ ] **Step 1: Restructure** — keep the existing email flow intact under `mode === 'email'`, add a phone flow as the default:

```ts
import * as phoneApi from '../../src/api/phone';
import { useAuth } from '../../src/auth/AuthContext';
import { usePhoneVerification } from '../../src/lib/usePhoneVerification';
import { PhoneVerifyCard } from '../../src/components/PhoneVerifyCard';

// inside the component:
  const { applySession } = useAuth();
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const v = usePhoneVerification();
  const digits = phone.replace(/\D/g, '');

  const beginPhone = () => v.start(() => phoneApi.startPhoneVerification(digits, 'reset'));
  const savePhonePassword = async () => {
    setError(null);
    const res = await phoneApi.resetWithPhone(v.verificationId!, newPassword);
    await applySession(res); // logged straight in; RootNavigator leaves (auth)
  };
```

Render, when `mode === 'phone'`:
- no session → title `forgotTitle`, body `forgotPhoneBody`, phone `TextField`, `ActionButton` «Үргэлжлүүлэх» (`action={beginPhone}`), then a text button `t('forgotByEmail')` → `setMode('email')`.
- session and `v.state !== 'verified'` → `PhoneVerifyCard` (`onRestart={() => beginPhone().catch(() => {})}`).
- `v.state === 'verified'` → green chip `✓ {digits}`, title `newPasswordTitle`, `TextField` `newPassword` (`secureToggle`), `ActionButton` `savePassword` (`action={savePhonePassword}`, `disabled={newPassword.length < 6}`, `onError={setError}`).

When `mode === 'email'`: the existing `step` UI unchanged.

- [ ] **Step 2: Manual test** — Forgot → phone → SMS card → new password → lands on Home; log out and log in with the new password + phone as identifier.

- [ ] **Step 3: Commit**

```bash
cd mobile && npx tsc --noEmit
git add "mobile/app/(auth)/forgot.tsx"
git commit -m "feat(mobile): утсаар нууц үг сэргээх (имэйл зам хэвээр)"
```

---

### Task C8: Phone gate + link from Account

**Files:**
- Create: `mobile/app/phone-link.tsx`
- Modify: `mobile/app/_layout.tsx` (RootNavigator effect)
- Modify: `mobile/app/account.tsx`

- [ ] **Step 1: Screen (gate and link in one)**

```tsx
// mobile/app/phone-link.tsx
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as phoneApi from '../src/api/phone';
import { useAuth } from '../src/auth/AuthContext';
import { usePhoneVerification } from '../src/lib/usePhoneVerification';
import { useColors } from '../src/settings/SettingsContext';
import { spacing } from '../src/theme/theme';
import { t } from '../src/i18n';
import { Screen } from '../src/components/Screen';
import { AppText } from '../src/components/Text';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { ActionButton } from '../src/components/ActionButton';
import { FormError } from '../src/components/FormError';
import { PhoneVerifyCard } from '../src/components/PhoneVerifyCard';

/**
 * `?gate=1` — the forced gate for email accounts without a verified phone
 * (server flag `user.needsPhone`; RootNavigator sends them here). No back, only
 * «Гарах». Without it: the optional «Холбох» from the Account screen.
 */
export default function PhoneLinkScreen() {
  const colors = useColors();
  const router = useRouter();
  const { gate } = useLocalSearchParams<{ gate?: string }>();
  const isGate = gate === '1';
  const { token, user, updateUser, logout } = useAuth();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const v = usePhoneVerification();
  const digits = phone.replace(/\D/g, '');

  const begin = () => v.start(() => phoneApi.startLinkPhone(digits, token!));

  useEffect(() => {
    if (v.state !== 'verified' || !v.verificationId || !token) return;
    phoneApi
      .linkPhone(v.verificationId, token)
      .then(async (fresh) => {
        await updateUser(fresh); // needsPhone=false → RootNavigator lets them through
        if (!isGate) router.back();
      })
      .catch((e) => {
        v.reset();
        setError(e instanceof Error ? e.message : t('errorGeneric'));
      });
  }, [v.state]);

  return (
    <Screen>
      {!isGate ? (
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
      ) : null}

      <AppText variant="h1" style={styles.title}>{isGate ? t('phoneGateTitle') : t('phoneLinkTitle')}</AppText>
      <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>
        {v.session ? t('phoneVerifyBody') : isGate ? t('phoneGateBody') : t('phoneLinkBody')}
      </AppText>

      {v.session ? (
        <PhoneVerifyCard verification={v} onRestart={() => begin().catch(() => {})} />
      ) : (
        <>
          <TextField leftIcon="call-outline" label={t('phone')} keyboardType="number-pad" maxLength={8} value={phone} onChangeText={setPhone} />
          <FormError message={error} />
          <ActionButton
            label={t('verifyAction')}
            action={begin}
            onError={setError}
            disabled={!/^[5-9]\d{7}$/.test(digits)}
            style={styles.button}
          />
        </>
      )}

      {isGate ? (
        <View style={styles.footer}>
          <AppText variant="caption" center color={colors.textMuted}>{`${user?.username ?? ''} ${t('signedInAs')}`}</AppText>
          <Button label={t('logout')} variant="ghost" onPress={logout} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  title: { marginTop: spacing.md },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.lg },
  button: { marginTop: spacing.md },
  footer: { marginTop: 'auto', gap: spacing.xs, paddingTop: spacing.lg },
});
```

(`t('logout')` — confirm the key name used by Settings' logout row; reuse it.)

- [ ] **Step 2: RootNavigator gate** — in `mobile/app/_layout.tsx`, inside the `if (token) {` branch, BEFORE the role redirects:

```ts
      // Email accounts without a verified phone must verify once (server flag
      // `needsPhone`). The gate lives outside (auth) because this effect throws
      // logged-in users out of (auth).
      if (user?.needsPhone) {
        if (segments[0] !== 'phone-link') router.replace('/phone-link?gate=1');
        return;
      }
      // Gate just passed (updateUser set needsPhone=false) → go home. The
      // optional link screen (opened from Account) has history and pops itself.
      if (segments[0] === 'phone-link' && !router.canGoBack()) {
        router.replace(isTeacher ? '/(teacher)' : '/(tabs)');
        return;
      }
```

- [ ] **Step 3: Account row** — in `mobile/app/account.tsx`, before the «Имэйл солих» row:

```tsx
          <Row
            c={c}
            icon="call"
            tint={tints.teal}
            label={t('phone')}
            value={user?.phoneVerified ? user.phone ?? '' : t('linkAction')}
            onPress={user?.phoneVerified ? undefined : () => router.push('/phone-link')}
          />
```

(Check `Row`'s props in `account.tsx` — it takes `value` and optional `onPress`/`last`.)

- [ ] **Step 4: Manual test**
1. Log in with an old email/password account that has no phone → lands on the gate (no back button) → verify → lands on Home; kill + reopen the app → no gate.
2. Log in with a Google account (native build only) or set up an account via `POST /auth/social` → no gate; Account → «Утасны дугаар · Холбох» → link → row shows the number.

- [ ] **Step 5: Commit**

```bash
cd mobile && npx tsc --noEmit
git add mobile/app/phone-link.tsx mobile/app/_layout.tsx mobile/app/account.tsx
git commit -m "feat(mobile): утасны gate + Аккаунтаас утас холбох"
git push origin usukhbayar
```

---

# PART D — Ship to the App Store (build 18)

> Every step here touches production or Apple. **Ask the user before each one marked 🔒.**

### Task D1: Docs

- [ ] Update `CLAUDE.md` → Current Status: a dated entry «Утасны дугаар баталгаажуулалт (verify.mn)» — what changed, the new env vars, the prod migration `AddPhoneVerification1788200000000` (check `DB_MIGRATIONS_RUN=true`), the shared files Choi/Boju must know about (`register.tsx`, `login`/`SignInSheet`, `forgot.tsx`, `_layout.tsx`, `account.tsx`, `i18n`, new `PhoneVerifyCard`), «`npm install` шаардлагагүй», and «шинэ хэрэглэгч имэйлээр сэргээх боломжгүй (утсаар л)».
- [ ] Commit `docs: утас баталгаажуулалт — CLAUDE.md`.

### Task D2: 🔒 Production backend

- [ ] User creates a verify.mn account (https://verify.mn/signup) and an API key; **user** puts it in Railway as `VERIFY_MN_API_KEY` (never paste it into chat or code).
- [ ] Confirm Railway has `DB_MIGRATIONS_RUN=true` (Railway MCP `list-variables` shows names even when values are redacted).
- [ ] Merge to `main` via PR (ask before `gh pr create`) → Railway deploys.
- [ ] Read the deploy log: migration `AddPhoneVerification1788200000000` ran; no `VERIFY_MN_API_KEY is not set` warning.
- [ ] Real-SMS smoke test from a real phone against prod (register → SMS → account). Also once: start a session for number A and send the code from number B → must stay pending.

### Task D3: 🔒 App Review demo account

Apple's reviewer cannot text a Mongolian shortcode, and the gate blocks phone-less email accounts. Prepare a demo account whose phone is already verified:

- [ ] Register `appreview` normally in the app (owner's phone), **or** set it on an existing demo account via SQL on prod (user runs / approves):

```sql
UPDATE users SET phone = '<8-digit number the owner controls>', phone_verified_at = now()
WHERE username = 'appreview';
```

- [ ] App Store Connect → App Review Information → Sign-in: username `appreview` + password. Notes:

> Registration requires a Mongolian mobile number: the user sends a one-time code by SMS to the shortcode 144773 (verify.mn). Reviewers outside Mongolia cannot complete this step, so please use the demo account above — it has a verified phone. "Log in with SMS" and phone password reset use the same SMS step.

### Task D4: 🔒 Build 18 + submit

- [ ] `cd mobile && npx tsc --noEmit` — clean.
- [ ] `eas fingerprint:compare --build-id 3a4989eb` (build 17). This change adds no native deps, so a match is expected → OTA would be possible, but the owner asked for an App Store build; still record the result in CLAUDE.md.
- [ ] Bump the build number per `eas.json` convention, then `eas build --platform ios --profile production` (ask first).
- [ ] `eas submit --platform ios --latest` (ask first). Poll status via Expo GraphQL (`submissions(filter:…)`) — killing the CLI does not cancel it.
- [ ] Add a «TestFlight build 18» row to CLAUDE.md (commit · EAS build id · submission id · contents).

---

## Self-review notes (done while writing)

- **Spec coverage:** §2 decisions → A4/A7/C5/C8; §3 verify.mn facts → A2/A3/C2; §4.1–4.2 endpoints → A3/A7/A8; §4.3 migration → A4; §4.4 security → A5/A6 (+ A4 lookups only on `phone_verified_at`); §4.5 client/fake → A2; §4.6 env → A9; §5 mobile → C1–C8; §6 admin → B1; §7 error codes → A1/A2/A3/A7 + client matching in C5–C8; §8 tests → A1–A8 + manual steps; §9 rollout → D2–D4; §10 ownership → D1; App Store → D3/D4.
- **Spec decision changed in planning:** email unique index kept as-is with `EMAIL_TAKEN` (already in the spec after review); module location / screen placement deviations listed at the top.
- **Names used consistently:** `PhoneVerificationService.start/status/consume`, `PhoneProof`, `PhonePurpose`, `VerifyMnClient.createSession/getStatus`, `VerifyMnConflictError`, `phoneError`, `normalizePhone/tryNormalizePhone`, `AuthService.checkAvailability/startPhone/startLinkPhone/registerWithPhone/loginWithPhone/resetWithPhone/linkPhone/publicUser`, `UsersService.findByVerifiedPhone/isPhoneTaken/isUsernameFree/setVerifiedPhone/clearPhone`, mobile `usePhoneVerification` → `{ state, session, verificationId, secondsLeft, error, start, reset }`, `PhoneVerifyCard({ verification, onRestart })`.
