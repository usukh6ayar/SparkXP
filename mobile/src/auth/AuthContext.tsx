import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import * as authApi from '../api/auth';
import type { AuthUser, RegisterPayload } from '../api/auth';

const TOKEN_KEY = 'englishxp.token';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** True while restoring the session on app start. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
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

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      if (saved) {
        const me = await authApi.getMe(saved);
        setToken(saved);
        setUser(me);
      }
    } catch {
      // Saved token invalid/expired — clear it and start logged out.
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  }

  async function persist(result: { accessToken: string; user: AuthUser }) {
    await SecureStore.setItemAsync(TOKEN_KEY, result.accessToken);
    setToken(result.accessToken);
    setUser(result.user);
  }

  async function login(email: string, password: string) {
    await persist(await authApi.login(email, password));
  }

  async function register(payload: RegisterPayload) {
    await persist(await authApi.register(payload));
  }

  async function logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ token, user, loading, login, register, logout }}
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
