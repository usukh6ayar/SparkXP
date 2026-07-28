import * as LocalAuthentication from 'expo-local-authentication';
import { t } from '../i18n';

/**
 * The single wrapper over expo-local-authentication — used by BOTH the app-lock
 * (AuthContext) and biometric sign-in (SignInSheet).
 *
 * Everything is best-effort: on any error we treat biometrics as unavailable /
 * the scan as failed, so a hardware quirk can never brick access — the app-level
 * "log in with password" fallback still lets the user in. Callers therefore
 * never need their own try/catch, which is exactly what the deleted duplicate
 * (`lib/biometric.ts`) got wrong: it threw, and one call site had no `.catch()`.
 */

/** Device has biometric hardware AND the user has enrolled a face/fingerprint. */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

/** Show the OS biometric sheet. Returns true only on a successful scan. */
export async function authenticateBiometric(promptMessage: string): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: t('cancel'),
      // Device passcode fallback stays ON so a failed scan isn't a dead end.
      disableDeviceFallback: false,
    });
    return res.success;
  } catch {
    return false;
  }
}
