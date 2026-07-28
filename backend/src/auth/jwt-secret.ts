import { ConfigService } from '@nestjs/config';

/** The placeholder that used to be the silent default. Never valid in prod. */
const INSECURE_DEFAULT = 'change-me';

/** Dev-only fallback so `npm run start:dev` works without a configured .env. */
const DEV_FALLBACK = 'dev-only-insecure-secret';

/**
 * Resolves the JWT signing secret — the ONE place both the signer
 * (`AuthModule`) and the verifier (`JwtStrategy`) read it, so they can never
 * drift apart and silently accept tokens signed with a different key.
 *
 * Fails fast in production. A missing `JWT_SECRET` used to fall back to the
 * literal string 'change-me', which meant anyone who read this open-source repo
 * could mint a token for any user — including `role: super_admin`. Refusing to
 * boot is loud and obvious; booting with a public key is silent and total.
 */
export function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  const isProd = config.get<string>('NODE_ENV') === 'production';

  if (isProd) {
    if (!secret || secret === INSECURE_DEFAULT || secret.length < 16) {
      throw new Error(
        'JWT_SECRET is missing, too short (<16 chars), or still the placeholder. ' +
          'Refusing to start in production — set a long random JWT_SECRET.',
      );
    }
    return secret;
  }

  return secret || DEV_FALLBACK;
}
