import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../auth/AuthContext';
import { canAccess, defaultPath } from '../auth/access';

/**
 * Per-page access guard. A moderator who hits an admin-only path (e.g. by typing
 * the URL) is bounced to their default page instead of seeing it.
 */
function RequireAccess({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!canAccess(user?.role, pathname)) {
    return <Navigate to={defaultPath(user?.role)} replace />;
  }
  return <>{children}</>;
}

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <RequireAccess>
            <Outlet />
          </RequireAccess>
        </div>
      </main>
    </div>
  );
}
