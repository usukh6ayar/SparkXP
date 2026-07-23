import { Suspense, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
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

/** Content-area spinner shown while a lazy route chunk loads. */
function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
    </div>
  );
}

export function Layout() {
  // Sidebar is an off-canvas drawer on mobile, always-visible on md+.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex flex-1 flex-col overflow-y-auto">
        {/* Mobile top bar — hamburger to open the sidebar */}
        <header className="flex items-center gap-3 border-b bg-white px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-900"
            aria-label="Цэс нээх"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-semibold text-gray-900">SparkXP Admin</span>
        </header>

        <div className="p-4 sm:p-6 lg:p-8">
          <RequireAccess>
            {/* Route pages are lazy-loaded (code-split) — show a spinner in the
                content area while a page chunk loads; the sidebar stays put. */}
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </RequireAccess>
        </div>
      </main>
    </div>
  );
}
