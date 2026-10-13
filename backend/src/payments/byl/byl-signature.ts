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
  const expected = Buffer.from(
    createHmac('sha256', secret).update(rawBody).digest('hex'),
  );
  const given = Buffer.from(header.trim());
  return expected.length === given.length && timingSafeEqual(expected, given);
}
