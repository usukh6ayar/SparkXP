/**
 * Single source of truth for the class-join deep link encoded in QR codes.
 *
 * Format: `englishxp://join/<CODE>` (scheme = app.json "scheme").
 * Keeping build + parse here means a printed QR stays compatible whenever the
 * student-side scanner / `join/[code]` route is built — both reuse this.
 */
const JOIN_PREFIX = 'englishxp://join/';

/** The value to encode in a class's QR code. */
export function buildJoinLink(code: string): string {
  return JOIN_PREFIX + code.trim().toUpperCase();
}

/**
 * Extract a join code from a scanned QR value. Accepts the full deep link or a
 * bare code, so the scanner is forgiving of either. Returns null if it doesn't
 * look like a code.
 */
export function parseJoinCode(value: string): string | null {
  const raw = value.trim();
  const code = raw.startsWith(JOIN_PREFIX) ? raw.slice(JOIN_PREFIX.length) : raw;
  return /^[A-Z0-9]{4,12}$/i.test(code) ? code.toUpperCase() : null;
}
