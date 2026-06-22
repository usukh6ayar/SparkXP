import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { isStaff } from './access';

/**
 * Gates the whole panel: only staff (moderator / admin / super_admin) may enter.
 * Per-page access (e.g. moderators can't open Users/Settings) is enforced
 * separately by <RequireAccess> in the Layout.
 */
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
  if (!isStaff(user.role)) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
