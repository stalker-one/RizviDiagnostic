import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Menu, LogOut, Undo2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import LiveClock from './LiveClock.jsx';
import Button from './Button.jsx';

export default function Navbar({ title, onMenuClick }) {
  const { user, logout, isImpersonating, stopImpersonating } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const returnToSuperadmin = async () => {
    try {
      await stopImpersonating();
      navigate('/users');
    } catch {
      // ignore — user can retry from the banner
    }
  };

  return (
    <>
      {isImpersonating && (
        <div className="bg-amber-500 text-white text-xs sm:text-sm px-3 sm:px-6 py-2 flex items-center justify-between gap-2 no-print">
          <span>
            Superadmin: acting as <strong>{user?.name}</strong> ({user?.role})
          </span>
          <button
            onClick={returnToSuperadmin}
            className="inline-flex items-center gap-1 font-medium underline hover:no-underline whitespace-nowrap"
          >
            <Undo2 size={14} /> Return to Superadmin
          </button>
        </div>
      )}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onMenuClick}
            className="md:hidden -ml-1 p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-slate-800 truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {settings?.headerClockEnabled !== false && (
            <LiveClock className="hidden sm:block pr-2 sm:border-r border-slate-200" />
          )}
          <Link to="/profile" className="flex items-center gap-2 sm:gap-3 group">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-slate-700 group-hover:text-brand-700">{user?.name}</div>
              <div className="text-xs text-slate-400 capitalize">{user?.role}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center font-semibold shrink-0">
              {user?.name?.charAt(0) || 'U'}
            </div>
          </Link>
          <Button
            variant="outline"
            size="sm"
            icon={LogOut}
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>
    </>
  );
}
