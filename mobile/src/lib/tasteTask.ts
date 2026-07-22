import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Remembers that the guest finished the pre-signup taste-task (C4) so the
 * register screen can claim the one-time onboarding XP bonus for it. Kept on
 * the device (not in a route param) because the guest may wander through
 * login/back before actually signing up.
 */
const KEY = 'taste_completed';

export async function markTasteCompleted(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // non-critical: the bonus is a nice-to-have, never block sign-up
  }
}

export async function peekTasteCompleted(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

/** Clear once the flag has been handed to the backend at registration. */
export async function clearTasteCompleted(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // non-critical
  }
}
