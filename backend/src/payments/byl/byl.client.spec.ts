import type { ConfigService } from '@nestjs/config';
import { BylClient } from './byl.client';

const config = (env: Record<string, string | undefined>) =>
  ({ get: (k: string) => env[k] }) as unknown as ConfigService;
const res = (status: number, body: unknown) =>
  ({ ok: status < 300, status, json: async () => body }) as Response;
const live = () =>
  new BylClient(config({ BYL_API_TOKEN: 'tok', BYL_PROJECT_ID: '7' }));

describe('BylClient', () => {
  const realFetch = global.fetch;
  afterEach(() => (global.fetch = realFetch));

  it('creates a checkout on the project with the bearer token', async () => {
    const f = jest.fn().mockResolvedValue(
      res(201, {
        data: { id: 13338, url: 'https://byl.mn/h/checkout/13338/x' },
      }),
    );
    global.fetch = f;
    const out = await live().createCheckout({
      items: [],
      client_reference_id: 'p1',
    });
    expect(out).toEqual({
      id: 13338,
      url: 'https://byl.mn/h/checkout/13338/x',
    });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://byl.mn/api/v1/projects/7/checkouts');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.headers.Accept).toBe('application/json');
  });

  it('reads a checkout', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      res(200, {
        data: {
          id: 1,
          status: 'complete',
          amount_total: '56000.000000',
          client_reference_id: 'p1',
        },
      }),
    );
    await expect(live().getCheckout(1)).resolves.toMatchObject({
      status: 'complete',
      amount_total: '56000.000000',
    });
  });

  it.each([422, 503, 500])('maps %i to 503 PAYMENT_UNAVAILABLE', async (s) => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(res(s, { error: 'missing_bank_account' }));
    const err = await live()
      .createCheckout({ items: [] })
      .catch((e) => e);
    expect(err.getStatus()).toBe(503);
    expect(err.getResponse()).toMatchObject({ code: 'PAYMENT_UNAVAILABLE' });
  });

  it('maps a network error to 503', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));
    expect(
      (
        await live()
          .getCheckout(1)
          .catch((e) => e)
      ).getStatus(),
    ).toBe(503);
  });

  it('refuses without token/project (fail closed, no network)', async () => {
    const f = jest.fn();
    global.fetch = f;
    const err = await new BylClient(config({}))
      .createCheckout({ items: [] })
      .catch((e) => e);
    expect(err.getStatus()).toBe(503);
    expect(f).not.toHaveBeenCalled();
  });
});
