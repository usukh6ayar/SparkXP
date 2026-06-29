import { NavLink, useNavigate } from 'react-router-dom';
import {
  BookOpen, FileText, HelpCircle, Users, BarChart2,
  Settings, LogOut, Zap, Trophy, Bot, GraduationCap,
  Building2, Activity, Bell, LifeBuoy, BookText, Quote,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { canAccess } from '../auth/access';
import { cn } from '../lib/utils';

const nav = [
  { to: '/words',         label: 'Үгс',          icon: BookOpen },
  { to: '/lessons',       label: 'Хичээл',       icon: FileText },
  { to: '/reading',       label: 'Унших',        icon: BookText },
  { to: '/idioms',        label: 'Хэлц үг',       icon: Quote },
  { to: '/quizzes',       label: 'Quiz',          icon: HelpCircle },
  { to: '/users',         label: 'Хэрэглэгч',   icon: Users },
  { to: '/classes',       label: 'Ангиуд',       icon: GraduationCap },
  { to: '/organizations', label: 'Байгууллага',  icon: Building2 },
  { to: '/leaderboard',   label: 'Leaderboard',  icon: Trophy },
  { to: '/buddy',         label: 'AI Buddy',     icon: Bot },
  { to: '/usage',         label: 'Хэрэглээ',     icon: Activity },
  { to: '/notifications', label: 'Мэдэгдэл',     icon: Bell },
  { to: '/monitor',       label: 'Монитор',      icon: BarChart2 },
  { to: '/settings',      label: 'Тохиргоо',    icon: Settings },
  { to: '/guide',         label: 'Заавар',       icon: LifeBuoy },
];

interface Props {
  /** Drawer open state (mobile only; always visible on md+). */
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Moderators only see content links; admins see everything.
  const visibleNav = nav.filter(({ to }) => canAccess(user?.role, to));

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <>
      {/* Backdrop — mobile only, click to close */}
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-screen w-56 flex-col bg-sidebar text-white transition-transform duration-200',
          'md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
      {/* Logo — purple gradient strip */}
      <div
        className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10"
        style={{ background: 'linear-gradient(135deg, #7A4DFF22 0%, transparent 100%)' }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/40">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-bold tracking-tight">SparkXP Admin</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {visibleNav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary text-white shadow-md shadow-primary/30'
                  : 'text-white/60 hover:bg-white/8 hover:text-white',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="border-t border-white/10 px-4 py-4">
        <p className="text-xs text-white/40 truncate mb-0.5">{user?.email}</p>
        <p className="text-sm font-semibold truncate text-white/90">{user?.fullName}</p>
        <button
          onClick={handleLogout}
          className="mt-3 flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" /> Гарах
        </button>
      </div>
      </aside>
    </>
  );
}
