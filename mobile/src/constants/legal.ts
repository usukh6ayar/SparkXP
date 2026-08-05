import { Linking } from 'react-native';

/**
 * Where the published Privacy Policy and Terms live.
 *
 * They are static pages in the admin app (`admin/public/*.html`), which already
 * auto-deploys to Vercel — no second host to maintain. Files under `public/`
 * are served without the dashboard's login, so they are genuinely public, which
 * is what App Store Connect and Play Console require.
 *
 * ⚠️ The **exact same Privacy Policy URL must be pasted into App Store Connect
 * and Play Console.** A store listing whose policy link 404s is a rejection.
 *
 * The base is overridable so a custom domain can replace the Vercel one later
 * without an app update — set `EXPO_PUBLIC_LEGAL_BASE_URL` and rebuild/OTA.
 */
const BASE =
  process.env.EXPO_PUBLIC_LEGAL_BASE_URL?.trim().replace(/\/$/, '') ||
  'https://sparkxp-admin.vercel.app';

export const LEGAL_URLS = {
  privacy: `${BASE}/privacy`,
  terms: `${BASE}/terms`,
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
