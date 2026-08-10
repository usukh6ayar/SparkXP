import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

/**
 * Lazily load the Google native module.
 *
 * A STATIC `import` of `@react-native-google-signin/google-signin` crashes Expo
 * Go at startup — the package touches its native `RNGoogleSignin` TurboModule at
 * eval time, and that module isn't in Expo Go. Requiring it only inside the
 * sign-in functions (which are only reachable in a dev/store build, where the
 * Google button is actually shown) keeps Expo Go working: the button is hidden
 * there, so this is never called and the native module is never touched.
 */
function googleModule(): typeof import('@react-native-google-signin/google-signin') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-google-signin/google-signin');
}

/**
 * The native half of Google / Apple sign-in.
 *
 * Each function returns the provider's **identity token** — a JWT the backend
 * verifies against the provider's public keys. Nothing here is trusted: the app
 * only carries the token across (`POST /auth/social`).
 *
 * ⚠️ Neither SDK works in Expo Go — both need native code, so this only runs in
 * a dev build or a store build. The buttons are hidden when the provider isn't
 * configured (`GET /auth/social/providers`), so Expo Go simply won't show them.
 */

/** Raised when the user backs out. Callers treat it as "nothing happened". */
export class SocialCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'SocialCancelled';
  }
}

/**
 * Google OAuth client ids (Firebase project `sparkxp-1`).
 *
 * ⚠️ **Hardcoded defaults on purpose — do not move these into `eas.json`.**
 * `hot-updater deploy` runs `expo export` locally and inlines `EXPO_PUBLIC_*`
 * from `mobile/.env`, never from an `eas.json` build profile. A value that
 * lives only in `eas.json` therefore reaches EAS builds but is `undefined` in
 * every OTA bundle — which is exactly how OTA silently disabled itself on
 * 2026-08-07 (see `HOT_UPDATER_URL` in `app/_layout.tsx`). Here the same
 * mistake would produce a Google button that opens and then fails.
 *
 * These are not secrets: OAuth client ids ship inside every app binary and the
 * iOS one is visible as a URL scheme in `Info.plist`. The security boundary is
 * the backend's `GOOGLE_CLIENT_IDS` audience allow-list, which is what actually
 * decides whether a token is accepted.
 *
 * Env still overrides, for pointing a build at a different Google project.
 */
const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  '371417423446-mv0qftkp1gmhldktqdnf1vonsfob802g.apps.googleusercontent.com';

/** Decides the id token's `aud` — must be listed in backend `GOOGLE_CLIENT_IDS`. */
const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '371417423446-o1df8ivrimesdo4a2ea6mrarv4jeqnaf.apps.googleusercontent.com';

let googleConfigured = false;

function configureGoogle(): void {
  if (googleConfigured) return;
  const { GoogleSignin } = googleModule();
  GoogleSignin.configure({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    // Required on Android to get an idToken at all, and it decides the token's
    // `aud`. Whatever lands there must be listed in the backend's
    // GOOGLE_CLIENT_IDS — that list is the audience allow-list.
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });
  googleConfigured = true;
}

/** Native Google sign-in → the account's identity token. */
export async function signInWithGoogle(): Promise<string> {
  const { GoogleSignin, statusCodes } = googleModule();
  configureGoogle();
  // Android only; resolves immediately elsewhere. Surfaces "no Play Services"
  // as an error instead of an empty sign-in sheet.
  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  try {
    const res = await GoogleSignin.signIn();
    // v13+ returns a discriminated union; older shapes put the token at the top.
    const idToken =
      (res as { data?: { idToken?: string | null } }).data?.idToken ??
      (res as { idToken?: string | null }).idToken;
    if (!idToken) throw new Error('Google did not return an identity token');
    return idToken;
  } catch (err) {
    if ((err as { code?: string }).code === statusCodes.SIGN_IN_CANCELLED) {
      throw new SocialCancelled();
    }
    throw err;
  }
}

/** Whether Sign in with Apple can be offered on this device (iOS 13+). */
export function isAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return Promise.resolve(false);
  return AppleAuthentication.isAvailableAsync();
}

/** Native Sign in with Apple → the account's identity token. */
export async function signInWithApple(): Promise<{
  idToken: string;
  /**
   * Apple sends the name on the FIRST authorisation only, and never again.
   * Pass it through to sign-up or it is lost for good.
   */
  fullName: string | null;
}> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      throw new Error('Apple did not return an identity token');
    }
    const name = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return { idToken: credential.identityToken, fullName: name || null };
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      throw new SocialCancelled();
    }
    throw err;
  }
}
