/**
 * Username rules, in one place.
 *
 * A username is the unique login handle (`identifier` on POST /auth/login), so
 * register and edit-profile must agree on what a valid one looks like — hence
 * this shared regex instead of a copy in each screen.
 */
export const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

/** True when `value` is a well-formed username (3–30 of a-z, 0-9, `_`). */
export function isValidUsername(value: string): boolean {
  return USERNAME_RE.test(value.trim());
}
