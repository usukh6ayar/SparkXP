import { NavLink, useNavigate } from 'react-router-dom';
import {
  BookOpen, FileText, HelpCircle, Users, BarChart2,
  Settings, LogOut, Zap, Trophy, Bot, GraduationCap,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { cn } from '../lib/utils';

const nav = [
  { to: '/words',       label: 'Үгс',         icon: BookOpen },
  { to: '/lessons',     label: 'Хичээл',      icon: FileText },
  { to: '/quizzes',     label: 'Сорил',       icon: HelpCircle },
  { to: '/users',       label: 'Хэрэглэгч',  icon: Users },
  { to: '/classes',     label: 'Ангиуд',      icon: GraduationCap },
  { to: '/leaderboard', label: 'Өрсөлдөөн',  icon: Trophy },
  { to: '/buddy',       label: 'AI Buddy',    icon: Bot },
  { to: '/monitor',     label: 'Монитор',     icon: BarChart2 },
  { to: '/settings',    label: 'Тохиргоо',   icon: Settings },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside className="flex h-screen w-56 flex-col bg-navy text-white">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-white/10">
        <Zap className="h-6 w-6 text-amber" />
        <span className="text-lg font-bold tracking-tight">SparkXP Admin</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="border-t border-white/10 px-4 py-4">
        <p className="text-xs text-white/50 truncate">{user?.email}</p>
        <p className="text-sm font-medium truncate">{user?.fullName}</p>
        <button
          onClick={handleLogout}
          className="mt-3 flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" /> Гарах
        </button>
      </div>
    </aside>
  );
}
