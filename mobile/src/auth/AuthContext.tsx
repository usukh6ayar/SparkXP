import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { ApiError } from '../api/client';
import * as authApi from '../api/auth';
import type { AuthResult, AuthUser } from '../api/auth';

const TOKEN_KEY = 'englishxp.token';
const USER_KEY = 'englishxp.user';
const ONBOARDED_KEY = 'englishxp.onboarded';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** True while restoring the session on app start. */
  loading: boolean;
  /** Whether the user has finished the first-launch onboarding. */
  onboarded: boolean;
  /** Log in with username (or email) + password. */
  login: (identifier: string, password: string) => Promise<void>;
  /** Persist a session from an already-fetched result (e.g. after OTP verify). */
  applySession: (result: AuthResult) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/**
 * Holds the auth session. On mount it restores a saved token from secure
 * storage and re-fetches the user, so a logged-in user stays logged in across
 * app restarts.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);

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

  async function clearSession() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    setToken(null);
    setUser(null);
  }

  async function persist(result: { accessToken: string; user: AuthUser }) {
    await SecureStore.setItemAsync(TOKEN_KEY, result.accessToken);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.user));
    setToken(result.accessToken);
    setUser(result.user);
  }

  async function login(identifier: string, password: string) {
    await persist(await authApi.login(identifier, password));
  }

  async function applySession(result: AuthResult) {
    await persist(result);
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
        login,
        applySession,
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
