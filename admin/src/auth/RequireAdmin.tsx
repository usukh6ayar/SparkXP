import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  if (!isAdmin) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
