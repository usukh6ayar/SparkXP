import { Linking } from 'react-native';

/**
 * Where the published Privacy Policy and Terms live.
 *
 * This is the **admin app's Vercel deployment**, where the pages actually live:
 * they are version-controlled in this repo at `admin/public/{privacy,terms}.html`
 * and Vercel serves everything under `public/` without the dashboard's login,
 * so they are genuinely public. One repo, one deploy, nothing to copy by hand.
 *
 * ⚠️ Two wrong hosts shipped before this one — `sparkxp-admin.vercel.app`
 * (never existed) and `spark-xp-web.vercel.app` (the marketing site is up, but
 * the legal pages were never copied into it). Both 404'd **in the app that went
 * to TestFlight**. Before changing this value, actually open both URLs:
 *
 *   curl -sIL https://<host>/privacy.html | head -1   # must be 200
 *   curl -sIL https://<host>/terms.html   | head -1
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
  'https://spark-xp.vercel.app';

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
