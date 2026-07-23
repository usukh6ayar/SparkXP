import * as SecureStore from 'expo-secure-store';

/**
 * "Remember me" credentials, stored encrypted in the OS keystore (same place
 * AuthContext keeps the auth token). Survives logout on purpose — the point of
 * remember-me is that after signing out you can sign back in without retyping,
 * and (with biometrics) unlock them with Face ID / fingerprint. Only cleared
 * when the user signs in with remember-me unchecked.
 */
const USERNAME_KEY = 'sparkxp.cred.username';
const PASSWORD_KEY = 'sparkxp.cred.password';

export interface SavedCredentials {
  username: string;
  password: string;
}

export async function saveCredentials(username: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(USERNAME_KEY, username);
  await SecureStore.setItemAsync(PASSWORD_KEY, password);
}

export async function loadCredentials(): Promise<SavedCredentials | null> {
  const [username, password] = await Promise.all([
    SecureStore.getItemAsync(USERNAME_KEY),
    SecureStore.getItemAsync(PASSWORD_KEY),
  ]);
  return username && password ? { username, password } : null;
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(USERNAME_KEY);
  await SecureStore.deleteItemAsync(PASSWORD_KEY);
}
