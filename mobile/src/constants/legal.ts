import { Linking } from 'react-native';

/**
 * Where the published Privacy Policy and Terms live.
 *
 * The marketing site, not the admin dashboard — the admin was never deployed,
 * so the old default 404'd in the shipped app (found while preparing the first
 * TestFlight build). The pages themselves are version-controlled in this repo
 * at `admin/public/{privacy,terms}.html`; copy them into the web project's
 * `public/` folder when either changes.
 *
 * ⚠️ The **exact same Privacy Policy URL must be pasted into App Store Connect
 * and Play Console.** A store listing whose policy link 404s is a rejection —
 * and Apple does open it.
 *
 * The `.html` extension is deliberate: it resolves on any static host with no
 * rewrite rule, so the link cannot break because of a hosting config nobody
 * remembers owning.
 *
 * Overridable via `EXPO_PUBLIC_LEGAL_BASE_URL` (set per-profile in `eas.json`)
 * so a custom domain can replace this without touching code.
 */
const BASE =
  process.env.EXPO_PUBLIC_LEGAL_BASE_URL?.trim().replace(/\/$/, '') ||
  'https://spark-xp-web.vercel.app';

export const LEGAL_URLS = {
  privacy: `${BASE}/privacy.html`,
  terms: `${BASE}/terms.html`,
} as const;

/**
 * Open a legal page in the device browser.
 *
 * Failure is swallowed on purpose: there is no useful recovery for "no browser
 * installed", and an error dialog on a legal link is worse than nothing.
 */
export function openLegal(page: keyof typeof LEGAL_URLS): void {
  Linking.openURL(LEGAL_URLS[page]).catch(() => {});
}
