import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { ApiError, clearApiCache } from '../api/client';
import * as authApi from '../api/auth';
import type { AuthResult, AuthUser } from '../api/auth';
import { setMonitoringUser } from '../lib/monitoring';
import { identifyUser, resetAnalytics, track } from '../lib/analytics';
import { registerForPush, unregisterPush } from '../lib/pushRegistration';
import {
  saveCredentials,
  clearCredentials,
  updateSavedProfile,
} from '../lib/savedCredentials';

const TOKEN_KEY = 'sparkxp.token';
const USER_KEY = 'sparkxp.user';
const ONBOARDED_KEY = 'sparkxp.onboarded';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** True while restoring the session on app start. */
  loading: boolean;
  /** Whether the user has finished the first-launch onboarding. */
  onboarded: boolean;
  /**
   * Log in with username (or email) + password.
   *
   * `remember` (default true) stores the credentials AND the display fields the
   * welcome screen's "continue as…" card needs. Doing it here rather than in the
   * caller is deliberate: this is the only place the fresh user object exists at
   * the moment the password is still in hand.
   */
  login: (identifier: string, password: string, remember?: boolean) => Promise<void>;
  /** Persist a session from an already-fetched result (e.g. after OTP verify). */
  applySession: (result: AuthResult) => Promise<void>;
  /** Replace the cached user (e.g. after editing profile / avatar). */
  updateUser: (user: AuthUser) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/**
 * Holds the auth session. On mount it restores a saved token from secure
 * storage and re-fetches the user, so a logged-in user stays logged in across
 * app restarts.
 *
 * There is no app-lock: the session simply persists, and the welcome screen
 * offers a one-tap "continue as…" card for someone who signed out. Face ID /
 * fingerprint used to gate a restored session; it was dropped (owner's
 * decision) in favour of that profile flow.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  // Live mirror for logout, which needs the token after state is torn down.
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      // First-launch flag — drives whether we show onboarding before login.
      setOnboarded((await SecureStore.getItemAsync(ONBOARDED_KEY)) === '1');
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!saved) return;

      // Trust the saved token immediately so we don't bounce to login on restart.
      setToken(saved);

      const cachedUser = await SecureStore.getItemAsync(USER_KEY);
      if (cachedUser) {
        try {
          const parsed = JSON.parse(cachedUser) as AuthUser;
          setUser(parsed);
          // Re-attach on every cold start, not just at login — otherwise a
          // crash on a restored session is reported with no user at all.
          attachIdentity(parsed);
        } catch {
          // Corrupt cache — will refresh from /me below.
        }
      }

      attachPush(saved);

      try {
        const me = await authApi.getMe(saved);
        setUser(me);
        attachIdentity(me);
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

  /**
   * Tell the monitoring + analytics layers who is signed in.
   *
   * Only the UUID and two coarse traits are shared — never email, username or
   * full name (see the privacy notes in `lib/monitoring.ts` / `lib/analytics.ts`).
   */
  function attachIdentity(next: AuthUser) {
    setMonitoringUser(next.id);
    identifyUser(next.id, { role: next.role, level: next.level });
  }

  /**
   * Hand this device's push token to the backend. Fire-and-forget: it prompts
   * for permission on first run and must never delay the session becoming
   * usable. No-ops in Expo Go and on simulators (see lib/pushRegistration).
   */
  function attachPush(accessToken: string) {
    registerForPush(accessToken);
  }

  async function clearSession() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    clearApiCache(); // don't leak this user's cached reads into the next session
    // Same reasoning as the cache wipe: the next person on this device must not
    // inherit the previous user's crash reports or analytics profile.
    setMonitoringUser(null);
    resetAnalytics();
    setToken(null);
    setUser(null);
  }

  async function persist(result: { accessToken: string; user: AuthUser }) {
    // The GET cache now survives a process kill (see api/persistCache.ts), so
    // logout alone is no longer enough — a fresh login on a device where
    // someone else was signed in must start from an empty cache.
    clearApiCache();
    await SecureStore.setItemAsync(TOKEN_KEY, result.accessToken);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.user));
    setToken(result.accessToken);
    setUser(result.user);
    attachIdentity(result.user);
    attachPush(result.accessToken);
  }

  async function login(identifier: string, password: string, remember = true) {
    const result = await authApi.login(identifier, password);
    await persist(result);
    // Fire-and-forget: the auth gate is already redirecting, and failing to
    // remember someone must never fail their sign-in.
    void (remember
      ? saveCredentials(identifier, password, {
          fullName: result.user.fullName,
          avatarUrl: result.user.avatarUrl,
        })
      : clearCredentials()
    ).catch(() => {});
    track('logged_in');
  }

  async function applySession(result: AuthResult) {
    await persist(result);
    // The only caller is the register screen, after the email OTP is verified —
    // so this is the moment an account is genuinely created.
    track('signed_up');
  }

  async function updateUser(next: AuthUser) {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(next));
    setUser(next);
    // Keep the "continue as…" card in step with a renamed user or a new avatar.
    // No-op when this device doesn't remember anyone.
    void updateSavedProfile({ fullName: next.fullName, avatarUrl: next.avatarUrl }).catch(() => {});
  }

  async function completeOnboarding() {
    await SecureStore.setItemAsync(ONBOARDED_KEY, '1');
    setOnboarded(true);
  }

  async function logout() {
    // Both of these need the session that clearSession() is about to destroy:
    // the analytics identity (or the event lands on a new anonymous person) and
    // the auth token (used to tell the backend to drop this device's push
    // token, so the next person on this phone gets no reminders of ours).
    track('logged_out');
    if (tokenRef.current) await unregisterPush(tokenRef.current);
    await clearSession();
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        onboarded,
        login,
        applySession,
        updateUser,
        completeOnboarding,
        logout,
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
