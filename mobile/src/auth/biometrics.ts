import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Thin wrapper over expo-local-authentication for the app-lock feature.
 * Everything is best-effort: on any error we treat biometrics as unavailable /
 * the scan as failed, so a hardware quirk can never brick access — the app-level
 * "log in with password" fallback still lets the user in.
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
    // Device passcode fallback stays ON (the default) — right for an app-lock.
    const res = await LocalAuthentication.authenticateAsync({ promptMessage });
    return res.success;
  } catch {
    return false;
  }
}
