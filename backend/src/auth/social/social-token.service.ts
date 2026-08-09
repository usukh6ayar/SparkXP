import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, type JsonWebKey } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { AuthProvider } from '../../common/enums';

/** What a verified provider token tells us about the person signing in. */
export interface SocialProfile {
  provider: AuthProvider;
  /** The provider's stable subject id. The only safe key for an account. */
  sub: string;
  email: string | null;
  emailVerified: boolean;
  fullName: string | null;
}

interface ProviderConfig {
  issuers: string[];
  jwksUrl: string;
}

const PROVIDERS: Record<AuthProvider, ProviderConfig> = {
  [AuthProvider.GOOGLE]: {
    // Google has issued both spellings for years; accept either.
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
  },
  [AuthProvider.APPLE]: {
    issuers: ['https://appleid.apple.com'],
    jwksUrl: 'https://appleid.apple.com/auth/keys',
  },
};

/** Signing keys rotate; re-fetch at most this often on a cache hit. */
const JWKS_TTL_MS = 60 * 60 * 1000;

/**
 * Verifies the identity token Google or Apple handed to the app.
 *
 * **This is the security boundary of social sign-in.** The app sends a token it
 * received from the provider; without checking the signature, the issuer and
 * the audience, anyone could POST a self-made JWT claiming any `sub` and take
 * over an account. So:
 *
 *  - signature is checked against the provider's published JWKS (RS256 only —
 *    never trust the token's own `alg`, or `alg: none` walks straight in);
 *  - `iss` must be the provider;
 *  - `aud` must be one of OUR client ids, so a token minted for a different app
 *    cannot be replayed here;
 *  - `exp`/`iat` are enforced by `jwt.verify`.
 *
 * Keys are cached in memory and re-fetched when an unknown `kid` appears, which
 * is what makes provider key rotation a non-event.
 */
@Injectable()
export class SocialTokenService {
  private readonly logger = new Logger(SocialTokenService.name);
  private jwks = new Map<AuthProvider, { keys: JsonWebKey[]; at: number }>();

  constructor(private readonly config: ConfigService) {}

  /** Client ids we accept as `aud`, per provider. Empty ⇒ provider disabled. */
  audiences(provider: AuthProvider): string[] {
    const raw =
      provider === AuthProvider.GOOGLE
        ? this.config.get<string>('GOOGLE_CLIENT_IDS')
        : this.config.get<string>('APPLE_CLIENT_IDS');
    return (raw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** Whether this provider is configured well enough to be offered at all. */
  isEnabled(provider: AuthProvider): boolean {
    return this.audiences(provider).length > 0;
  }

  async verify(provider: AuthProvider, idToken: string): Promise<SocialProfile> {
    const audiences = this.audiences(provider);
    if (audiences.length === 0) {
      // Config error, not a user error — but never echo which id is missing.
      throw new UnauthorizedException(`${provider} нэвтрэлт тохируулагдаагүй байна`);
    }

    const decoded = jwt.decode(idToken, { complete: true });
    const kid = decoded?.header?.kid;
    if (!decoded || typeof kid !== 'string') {
      throw new UnauthorizedException('Токен буруу байна');
    }

    const key = await this.publicKey(provider, kid);
    const { issuers } = PROVIDERS[provider];

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(idToken, key, {
        algorithms: ['RS256'],
        // jsonwebtoken types these as non-empty tuples; both are non-empty
        // here (an empty `audiences` returns early above).
        issuer: issuers as [string, ...string[]],
        audience: audiences as [string, ...string[]],
      }) as jwt.JwtPayload;
    } catch (err) {
      // Expired / wrong audience / bad signature all land here. The detail goes
      // to the log, never to the client.
      this.logger.warn(`${provider} token rejected: ${String(err)}`);
      throw new UnauthorizedException('Токен хүчингүй байна');
    }

    if (!payload.sub) throw new UnauthorizedException('Токен буруу байна');

    return {
      provider,
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
      // Apple sends this as the STRING "true"; Google as a boolean.
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      fullName: typeof payload.name === 'string' ? payload.name : null,
    };
  }

  /** PEM for `kid`, fetching (or re-fetching, on an unknown kid) the JWKS. */
  private async publicKey(provider: AuthProvider, kid: string): Promise<string> {
    let keys = await this.keys(provider, false);
    let jwk = keys.find((k) => (k as { kid?: string }).kid === kid);
    if (!jwk) {
      // Unknown kid ⇒ the provider rotated. Re-fetch once before giving up.
      keys = await this.keys(provider, true);
      jwk = keys.find((k) => (k as { kid?: string }).kid === kid);
    }
    if (!jwk) throw new UnauthorizedException('Токен хүчингүй байна');

    return createPublicKey({ key: jwk, format: 'jwk' })
      .export({ type: 'spki', format: 'pem' })
      .toString();
  }

  private async keys(provider: AuthProvider, force: boolean): Promise<JsonWebKey[]> {
    const cached = this.jwks.get(provider);
    if (!force && cached && Date.now() - cached.at < JWKS_TTL_MS) return cached.keys;

    const res = await fetch(PROVIDERS[provider].jwksUrl);
    if (!res.ok) {
      // Serve stale keys rather than locking everyone out over a blip at the
      // provider — they are still cryptographically checked below.
      if (cached) return cached.keys;
      throw new UnauthorizedException('Нэвтрэлтийн үйлчилгээ түр боломжгүй байна');
    }
    const body = (await res.json()) as { keys?: JsonWebKey[] };
    const keys = body.keys ?? [];
    this.jwks.set(provider, { keys, at: Date.now() });
    return keys;
  }
}
