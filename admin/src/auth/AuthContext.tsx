import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../api/client';

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
      .catch(() => localStorage.removeItem('admin_token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { access_token, user } = await api.post<{ access_token: string; user: AuthUser }>(
      '/auth/login',
      { email, password },
    );
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      throw new Error('Таны эрх хүрэхгүй байна');
    }
    localStorage.setItem('admin_token', access_token);
    setUser(user);
  }

  function logout() {
    localStorage.removeItem('admin_token');
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
