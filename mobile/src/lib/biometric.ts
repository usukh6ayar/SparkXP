import * as LocalAuthentication from 'expo-local-authentication';
import { t } from '../i18n';

/**
 * Face ID / Touch ID / fingerprint helpers (expo-local-authentication).
 * Requires a native rebuild — the module + the app.json config plugin are
 * compiled in, so a JS-only reload won't pick this up.
 */

/** True only when the device has biometric hardware AND a face/finger is enrolled. */
export async function isBiometricAvailable(): Promise<boolean> {
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && enrolled;
}

/** Prompt the OS biometric sheet. Resolves true only on a successful scan. */
export async function authenticateBiometric(): Promise<boolean> {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: t('biometricPrompt'),
    cancelLabel: t('cancel'),
    // Allow the device passcode as a fallback so a failed scan isn't a dead end.
    disableDeviceFallback: false,
  });
  return res.success;
}
