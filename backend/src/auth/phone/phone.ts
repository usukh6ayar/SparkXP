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
