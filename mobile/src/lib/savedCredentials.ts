import * as SecureStore from 'expo-secure-store';

/**
 * The "continue as…" profile: who last signed in on this device, and the
 * credentials to sign them back in with one tap.
 *
 * Stored encrypted in the OS keystore (same place AuthContext keeps the auth
 * token). Survives logout on purpose — that is the whole point: after signing
 * out you tap your face on the welcome screen and you're back in, the way
 * Duolingo works. Cleared only by "use another account".
 *
 * ⚠️ The display fields are a **cache for the card**, nothing more. They are
 * shown before any network call and can be stale (a renamed user, a changed
 * avatar); the real user object always comes from the server on sign-in.
 */
const USERNAME_KEY = 'sparkxp.cred.username';
const PASSWORD_KEY = 'sparkxp.cred.password';
const PROFILE_KEY = 'sparkxp.cred.profile';

export interface SavedCredentials {
  username: string;
  password: string;
}

/** What the welcome-screen card needs to render without a session. */
export interface SavedProfile {
  fullName: string | null;
  avatarUrl: string | null;
}

export type SavedAccount = SavedCredentials & SavedProfile;

export async function saveCredentials(
  username: string,
  password: string,
  profile?: SavedProfile,
): Promise<void> {
  await SecureStore.setItemAsync(USERNAME_KEY, username);
  await SecureStore.setItemAsync(PASSWORD_KEY, password);
  if (profile) {
    await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(profile));
  }
}

/**
 * Update just the display half, e.g. after the user edits their profile, so the
 * card doesn't keep showing an old name. No-op when nothing is remembered —
 * writing a profile with no credentials would render a card that can't sign in.
 */
export async function updateSavedProfile(profile: SavedProfile): Promise<void> {
  const username = await SecureStore.getItemAsync(USERNAME_KEY);
  if (!username) return;
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(profile));
}

export async function loadCredentials(): Promise<SavedCredentials | null> {
  const [username, password] = await Promise.all([
    SecureStore.getItemAsync(USERNAME_KEY),
    SecureStore.getItemAsync(PASSWORD_KEY),
  ]);
  return username && password ? { username, password } : null;
}

/** Credentials + the cached display fields, for the "continue as…" card. */
export async function loadSavedAccount(): Promise<SavedAccount | null> {
  const creds = await loadCredentials();
  if (!creds) return null;

  let profile: SavedProfile = { fullName: null, avatarUrl: null };
  try {
    const raw = await SecureStore.getItemAsync(PROFILE_KEY);
    if (raw) profile = { ...profile, ...(JSON.parse(raw) as SavedProfile) };
  } catch {
    // Corrupt or from an older build — the card falls back to the username.
  }
  return { ...creds, ...profile };
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(USERNAME_KEY);
  await SecureStore.deleteItemAsync(PASSWORD_KEY);
  await SecureStore.deleteItemAsync(PROFILE_KEY);
}
