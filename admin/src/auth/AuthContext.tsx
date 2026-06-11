import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api, setToken } from '../api/client';

interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { setLoading(false); return; }

    api.get<AuthUser>('/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<Record<string, unknown>>('/auth/login', { email, password });
    // Handle both camelCase and snake_case token field names for robustness
    const token = (res.accessToken ?? res.access_token) as string | undefined;
    const authUser = res.user as AuthUser | undefined;
    if (!token || !authUser) {
      throw new Error('Серверээс буруу хариу ирлээ');
    }
    if (authUser.role !== 'admin' && authUser.role !== 'super_admin') {
      throw new Error('Таны эрх хүрэхгүй байна');
    }
    setToken(token);
    setUser(authUser);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
