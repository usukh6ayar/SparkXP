import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { VerifyMnClient, VerifyMnConflictError } from './verify-mn.client';

const config = (env: Record<string, string | undefined>) =>
  ({ get: (k: string) => env[k] }) as unknown as ConfigService;

const json = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

describe('VerifyMnClient', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
  });

  const live = () =>
    new VerifyMnClient(config({ VERIFY_MN_API_KEY: 'vrf_test' }));

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
    expect(JSON.parse(init.body)).toEqual({
      phone: '99112233',
      text: '482916',
    });
  });

  it('maps 409 (same phone+text still active) to VerifyMnConflictError', async () => {
    global.fetch = jest.fn().mockResolvedValue(json(409, {}));
    await expect(
      live().createSession('99112233', '111111'),
    ).rejects.toBeInstanceOf(VerifyMnConflictError);
  });

  it.each([401, 500])('maps %i to 503 SMS_UNAVAILABLE', async (status) => {
    global.fetch = jest.fn().mockResolvedValue(json(status, {}));
    const err = await live()
      .createSession('99112233', '111111')
      .catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(503);
    expect(err.getResponse()).toMatchObject({ code: 'SMS_UNAVAILABLE' });
  });

  it('maps a network failure to 503', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const err = await live()
      .getStatus('s1')
      .catch((e) => e);
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
    global.fetch = jest
      .fn()
      .mockResolvedValue(json(200, { sessionStatus: 'EXPIRED' }));
    expect(await live().getStatus('s1')).toBe('EXPIRED');
  });

  it('without a key (and not fake) refuses with 503 instead of calling out', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const err = await new VerifyMnClient(config({}))
      .createSession('99112233', '1')
      .catch((e) => e);
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
      const c = new VerifyMnClient(
        config({ VERIFY_MN_FAKE: 'true', NODE_ENV: 'production' }),
      );
      expect(() => c.onModuleInit()).toThrow(/VERIFY_MN_FAKE/);
    });
  });
});
