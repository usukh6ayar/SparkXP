import { Linking } from 'react-native';

/**
 * Where the published Privacy Policy and Terms live.
 *
 * The **marketing site** — that is where a store reviewer (and a parent) expects
 * a policy to live, not on an admin dashboard.
 *
 * ⚠️ **The pages are NOT hosted here automatically.** The source of truth is
 * this repo (`admin/public/{privacy,terms}.html`); the marketing site is a
 * separate project, so both files must be copied into its `public/` folder and
 * re-copied whenever either changes. Two shipped builds already 404'd on this
 * link — `sparkxp-admin.vercel.app` (a host that never existed) and this one
 * before the pages were uploaded. Verify, never assume:
 *
 *   curl -sIL https://spark-xp-web.vercel.app/privacy.html | head -1  # 200
 *   curl -sIL https://spark-xp-web.vercel.app/terms.html   | head -1  # 200
 *
 * (`https://spark-xp.vercel.app/privacy.html` — the admin deployment — serves
 * the same two files today with no manual step, and is the fallback if keeping
 * the marketing copy in sync turns out to be a chore.)
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
