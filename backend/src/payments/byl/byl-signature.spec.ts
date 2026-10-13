import { createHmac } from 'crypto';
import { verifyBylSignature } from './byl-signature';

const secret = 'whsec_test';
const body = Buffer.from(
  '{"id":3,"type":"checkout.completed","data":{"object":{"id":71}}}',
);
const sign = (b: Buffer) =>
  createHmac('sha256', secret).update(b).digest('hex');

describe('verifyBylSignature', () => {
  it('accepts the HMAC of the exact raw body', () => {
    expect(verifyBylSignature(body, sign(body), secret)).toBe(true);
  });

  it('rejects a wrong signature', () => {
    expect(verifyBylSignature(body, sign(Buffer.from('x')), secret)).toBe(
      false,
    );
  });

  it('rejects a re-serialised body (why the RAW body is required)', () => {
    const reserialised = Buffer.from(
      JSON.stringify(JSON.parse(body.toString()), null, 1),
    );
    expect(verifyBylSignature(reserialised, sign(body), secret)).toBe(false);
  });

  it.each([
    ['no body', undefined, 'abc', secret],
    ['no header', body, undefined, secret],
    ['no secret', body, sign(body), undefined],
    ['length mismatch', body, 'abc', secret],
  ])('rejects %s', (_l, b, h, s) => {
    expect(
      verifyBylSignature(
        b as Buffer | undefined,
        h as string | undefined,
        s as string | undefined,
      ),
    ).toBe(false);
  });
});
