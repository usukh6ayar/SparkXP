import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';

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

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

let googleConfigured = false;

function configureGoogle(): void {
  if (googleConfigured) return;
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
