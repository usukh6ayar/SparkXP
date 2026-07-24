import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { ApiError, clearApiCache } from '../api/client';
import * as authApi from '../api/auth';
import type { AuthResult, AuthUser } from '../api/auth';
import { t } from '../i18n';
import { isBiometricAvailable, authenticateBiometric } from './biometrics';

const TOKEN_KEY = 'englishxp.token';
const USER_KEY = 'englishxp.user';
const ONBOARDED_KEY = 'englishxp.onboarded';
const BIOMETRIC_KEY = 'englishxp.biometric';
const BIOMETRIC_ASKED_KEY = 'englishxp.biometricAsked';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** True while restoring the session on app start. */
  loading: boolean;
  /** Whether the user has finished the first-launch onboarding. */
  onboarded: boolean;
  /** Whether Face ID / fingerprint app-lock is turned on. */
  biometricEnabled: boolean;
  /** True while the app is locked behind biometrics (drives the lock screen). */
  biometricLocked: boolean;
  /** Log in with username (or email) + password. */
  login: (identifier: string, password: string) => Promise<void>;
  /** Persist a session from an already-fetched result (e.g. after OTP verify). */
  applySession: (result: AuthResult) => Promise<void>;
  /** Replace the cached user (e.g. after editing profile / avatar). */
  updateUser: (user: AuthUser) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  logout: () => Promise<void>;
  /** Turn the biometric app-lock on/off (persists the choice). */
  setBiometricEnabled: (on: boolean) => Promise<void>;
  /** Show the OS biometric sheet; unlocks the app on a successful scan. */
  runBiometricUnlock: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/**
 * Holds the auth session. On mount it restores a saved token from secure
 * storage and re-fetches the user, so a logged-in user stays logged in across
 * app restarts. When the biometric app-lock is on, that restored session opens
 * locked and must be unlocked with Face ID / fingerprint (see the LockScreen).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [biometricEnabled, setBioState] = useState(false);
  const [locked, setLocked] = useState(false);

  // Live mirrors for the AppState listener (a stable closure that must read the
  // current values without re-subscribing on every change).
  const tokenRef = useRef<string | null>(null);
  const bioRef = useRef(false);
  const lockedRef = useRef(false);
  // True while the OS biometric sheet is up. The sheet sends the app briefly to
  // 'inactive'→'active', which would otherwise re-fire the prompt in a loop.
  const authRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  tokenRef.current = token;
  bioRef.current = biometricEnabled;
  lockedRef.current = locked;

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      // First-launch flag — drives whether we show onboarding before login.
      setOnboarded((await SecureStore.getItemAsync(ONBOARDED_KEY)) === '1');
      const bioOn = (await SecureStore.getItemAsync(BIOMETRIC_KEY)) === '1';
      setBioState(bioOn);

      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!saved) return;

      // Trust the saved token immediately so we don't bounce to login on restart.
      setToken(saved);
      // Lock the restored session before we stop loading, so the spinner (not the
      // app content) covers the window until biometrics unlock it — no flash.
      if (bioOn) setLocked(true);

      const cachedUser = await SecureStore.getItemAsync(USER_KEY);
      if (cachedUser) {
        try {
          setUser(JSON.parse(cachedUser) as AuthUser);
        } catch {
          // Corrupt cache — will refresh from /me below.
        }
      }

      try {
        const me = await authApi.getMe(saved);
        setUser(me);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(me));
      } catch (err) {
        // Only clear the session when the token is actually invalid/expired.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          await clearSession();
        }
      }
    } finally {
      setLoading(false);
    }
  }

  /** Show the biometric sheet; unlock on success. Guarded so overlapping calls
   *  (mount + the AppState 'active' event) don't stack prompts. */
  const runBiometricUnlock = useCallback(async () => {
    if (authRef.current) return;
    authRef.current = true;
    try {
      const ok = await authenticateBiometric(t('biometricPrompt'));
      if (ok) setLocked(false);
    } finally {
      // Clear a beat later: the sheet's own inactive→active event lands just
      // after this resolves; clearing synchronously would re-trigger the prompt.
      setTimeout(() => { authRef.current = false; }, 600);
    }
  }, []);

  // Re-lock a logged-in session (and re-prompt) whenever the app returns to the
  // foreground — "lock on every open". Guarded against the biometric sheet's own
  // background/foreground cycle via authRef.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next !== 'active' || prev === 'active') return;
      if (authRef.current) return; // the biometric sheet itself — ignore
      if (!tokenRef.current || !bioRef.current) return;
      if (!lockedRef.current) setLocked(true);
      runBiometricUnlock();
    });
    return () => sub.remove();
  }, [runBiometricUnlock]);

  async function clearSession() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    clearApiCache(); // don't leak this user's cached reads into the next session
    setToken(null);
    setUser(null);
    setLocked(false);
  }

  async function persist(result: { accessToken: string; user: AuthUser }) {
    await SecureStore.setItemAsync(TOKEN_KEY, result.accessToken);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.user));
    setToken(result.accessToken);
    setUser(result.user);
    setLocked(false); // just authenticated with a password — start unlocked
  }

  const setBiometricEnabled = useCallback(async (on: boolean) => {
    await SecureStore.setItemAsync(BIOMETRIC_KEY, on ? '1' : '0');
    setBioState(on);
    // Turning it on now does NOT lock (the user just authenticated); it takes
    // effect on the next foreground. Turning it off clears any lock.
    if (!on) setLocked(false);
  }, []);

  /** After a returning user logs in on a capable device, offer the app-lock once. */
  async function maybeOfferBiometric() {
    try {
      if ((await SecureStore.getItemAsync(BIOMETRIC_ASKED_KEY)) === '1') return;
      if ((await SecureStore.getItemAsync(BIOMETRIC_KEY)) === '1') return;
      if (!(await isBiometricAvailable())) return;
      await SecureStore.setItemAsync(BIOMETRIC_ASKED_KEY, '1');
      Alert.alert(t('biometricOfferTitle'), t('biometricOfferBody'), [
        { text: t('notNow'), style: 'cancel' },
        { text: t('enable'), onPress: () => { setBiometricEnabled(true); } },
      ]);
    } catch {
      // Offering is best-effort — never block login over it.
    }
  }

  async function login(identifier: string, password: string) {
    await persist(await authApi.login(identifier, password));
    maybeOfferBiometric();
  }

  async function applySession(result: AuthResult) {
    await persist(result);
  }

  async function updateUser(next: AuthUser) {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(next));
    setUser(next);
  }

  async function completeOnboarding() {
    await SecureStore.setItemAsync(ONBOARDED_KEY, '1');
    setOnboarded(true);
  }

  async function logout() {
    await clearSession();
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        onboarded,
        biometricEnabled,
        biometricLocked: locked,
        login,
        applySession,
        updateUser,
        completeOnboarding,
        logout,
        setBiometricEnabled,
        runBiometricUnlock,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Access the auth session. Throws if used outside <AuthProvider>. */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}
