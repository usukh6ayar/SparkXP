import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { SocialTokenService } from './social-token.service';
import { AuthProvider } from '../../common/enums';

/**
 * This service is the whole security boundary of social sign-in: the app hands
 * up a token it got from Google/Apple, and everything downstream trusts the
 * `sub` it yields. So the cases that matter are the forgeries.
 *
 * A real RSA keypair is generated per run and published as the provider's JWKS
 * through a stubbed `fetch`, so signatures are genuinely verified rather than
 * mocked away.
 */
describe('SocialTokenService', () => {
  const GOOGLE_AUD = '1234-ios.apps.googleusercontent.com';
  const GOOGLE_ISS = 'https://accounts.google.com';
  const KID = 'test-key-1';

  // The provider's real key…
  const real = generateKeyPairSync('rsa', { modulusLength: 2048 });
  // …and an attacker's, never published in the JWKS.
  const attacker = generateKeyPairSync('rsa', { modulusLength: 2048 });

  // `publicKey` is already a public KeyObject — export it straight to JWK.
  // (`createPublicKey(keyObject)` expects a PRIVATE key to derive from.)
  const jwkOf = (key: typeof real.publicKey, kid: string) => ({
    ...(key.export({ format: 'jwk' }) as Record<string, unknown>),
    kid,
    alg: 'RS256',
    use: 'sig',
  });

  const service = (ids = GOOGLE_AUD) =>
    new SocialTokenService({
      get: (k: string) => (k === 'GOOGLE_CLIENT_IDS' ? ids : ''),
    } as unknown as ConfigService);

  const sign = (
    payload: Record<string, unknown>,
    key: typeof real.privateKey = real.privateKey,
  ) =>
    jwt.sign(payload, key, {
      algorithm: 'RS256',
      keyid: KID,
      issuer: GOOGLE_ISS,
      audience: GOOGLE_AUD,
      expiresIn: '5m',
    });

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [jwkOf(real.publicKey, KID)] }),
    }) as unknown as typeof fetch;
  });

  it('accepts a properly signed token and returns the profile', async () => {
    const token = sign({ sub: 'g-123', email: 'A@Example.com', email_verified: true, name: 'A B' });
    const profile = await service().verify(AuthProvider.GOOGLE, token);

    expect(profile.sub).toBe('g-123');
    expect(profile.email).toBe('a@example.com'); // normalised
    expect(profile.emailVerified).toBe(true);
    expect(profile.fullName).toBe('A B');
  });

  it('rejects a token signed with a key that is not in the JWKS', async () => {
    // The forgery that matters: right shape, right claims, wrong signer.
    const token = sign({ sub: 'g-123' }, attacker.privateKey);
    await expect(service().verify(AuthProvider.GOOGLE, token)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects alg:none — an unsigned token must never pass', async () => {
    // Hand-assembled, the way an attacker would: correct claims, a real `kid`
    // so key lookup succeeds, and no signature at all. Accepting this is the
    // classic JWT failure, which is why `verify` pins `algorithms: ['RS256']`.
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const token = `${b64({ alg: 'none', typ: 'JWT', kid: KID })}.${b64({
      sub: 'g-123',
      iss: GOOGLE_ISS,
      aud: GOOGLE_AUD,
      exp: Math.floor(Date.now() / 1000) + 300,
    })}.`;

    await expect(service().verify(AuthProvider.GOOGLE, token)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token minted for a different app (wrong aud)', async () => {
    const token = jwt.sign({ sub: 'g-123' }, real.privateKey, {
      algorithm: 'RS256',
      keyid: KID,
      issuer: GOOGLE_ISS,
      audience: 'someone-elses-app.apps.googleusercontent.com',
      expiresIn: '5m',
    });
    await expect(service().verify(AuthProvider.GOOGLE, token)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token from a different issuer', async () => {
    const token = jwt.sign({ sub: 'g-123' }, real.privateKey, {
      algorithm: 'RS256',
      keyid: KID,
      issuer: 'https://evil.example.com',
      audience: GOOGLE_AUD,
      expiresIn: '5m',
    });
    await expect(service().verify(AuthProvider.GOOGLE, token)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an expired token', async () => {
    const token = jwt.sign({ sub: 'g-123' }, real.privateKey, {
      algorithm: 'RS256',
      keyid: KID,
      issuer: GOOGLE_ISS,
      audience: GOOGLE_AUD,
      expiresIn: '-10s',
    });
    await expect(service().verify(AuthProvider.GOOGLE, token)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refuses outright when the provider has no client ids configured', async () => {
    const token = sign({ sub: 'g-123' });
    await expect(service('').verify(AuthProvider.GOOGLE, token)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(service('').isEnabled(AuthProvider.GOOGLE)).toBe(false);
    expect(service().isEnabled(AuthProvider.GOOGLE)).toBe(true);
  });

  it('re-fetches the JWKS when the provider rotates to a new kid', async () => {
    const rotated = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const NEW_KID = 'test-key-2';
    let call = 0;
    global.fetch = jest.fn().mockImplementation(async () => ({
      ok: true,
      // First answer is stale (old key only); the retry carries the new one.
      json: async () => ({
        keys: call++ === 0 ? [jwkOf(real.publicKey, KID)] : [jwkOf(rotated.publicKey, NEW_KID)],
      }),
    })) as unknown as typeof fetch;

    const token = jwt.sign({ sub: 'g-rot' }, rotated.privateKey, {
      algorithm: 'RS256',
      keyid: NEW_KID,
      issuer: GOOGLE_ISS,
      audience: GOOGLE_AUD,
      expiresIn: '5m',
    });

    await expect(service().verify(AuthProvider.GOOGLE, token)).resolves.toMatchObject({
      sub: 'g-rot',
    });
  });

  it("treats Apple's string email_verified as verified", async () => {
    const svc = new SocialTokenService({
      get: (k: string) => (k === 'APPLE_CLIENT_IDS' ? 'mn.app.sparkxp' : ''),
    } as unknown as ConfigService);
    const token = jwt.sign(
      { sub: 'a-1', email: 'x@privaterelay.appleid.com', email_verified: 'true' },
      real.privateKey,
      {
        algorithm: 'RS256',
        keyid: KID,
        issuer: 'https://appleid.apple.com',
        audience: 'mn.app.sparkxp',
        expiresIn: '5m',
      },
    );
    await expect(svc.verify(AuthProvider.APPLE, token)).resolves.toMatchObject({
      emailVerified: true,
    });
  });
});
