/**
 * Cloudinary delivery helper.
 *
 * Our generated media (word/idiom images, reading covers, buddy avatars) is
 * served from Cloudinary. By default we store the full-resolution master URL,
 * which is wasteful to download on a phone. This helper rewrites a Cloudinary
 * delivery URL to add on-the-fly optimization:
 *   - f_auto  → best format for the device (WebP/AVIF)
 *   - q_auto  → automatic quality (much smaller, visually identical)
 *   - w_<n>,c_limit,dpr_auto → cap width to what we actually render
 *
 * Non-Cloudinary URLs (or missing ones) pass through unchanged, so it is safe
 * to wrap every remote image.
 */
import Constants from 'expo-constants';

// On a physical device, backend URLs that point at `localhost` (e.g. avatars /
// uploaded images stored locally in dev) are unreachable — `localhost` is the
// phone itself. Rewrite them to the same LAN host Expo is served from (the dev
// PC), matching how the API client resolves its base URL.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
function rewriteDevHost(url: string): string {
  if (!devHost) return url;
  return url.replace(
    /^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/])/,
    `$1${devHost}`,
  );
}

export function cldUrl(url: string | null | undefined, width?: number): string | undefined {
  if (!url) return undefined;
  url = rewriteDevHost(url);
  const marker = '/upload/';
  const i = url.indexOf(marker);
  // Not a Cloudinary /upload/ URL, or already transformed → leave as-is.
  if (i === -1 || url.includes('/upload/f_auto')) return url;

  const parts = [`f_auto`, `q_auto`, `dpr_auto`];
  if (width) parts.push(`w_${Math.round(width)}`, `c_limit`);
  const transform = parts.join(',');

  return `${url.slice(0, i + marker.length)}${transform}/${url.slice(i + marker.length)}`;
}
