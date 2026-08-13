import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users2, FilePlus2, ReceiptText, ClipboardList,
  BarChart3, Stethoscope, ListChecks, ShieldCheck, Settings as SettingsIcon, X, UserCog,
  Power,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import Logo from './Logo.jsx';

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
    isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'
  }`;

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/patients', label: 'Patients', icon: Users2 },
  { to: '/invoices/create', label: 'Create Invoice', icon: FilePlus2 },
  // `end` — without this, NavLink's default prefix match means this link
  // also lights up on /invoices/create and /invoices/:id/print (both start
  // with "/invoices"), so "Invoices" and "Create Invoice" would show active
  // at the same time. `end` restricts it to the exact /invoices path.
  { to: '/invoices', label: 'Invoices', icon: ReceiptText, end: true },
  { to: '/radiology-reports', label: 'Radiology Reports', icon: ClipboardList },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/referrals', label: 'Referrals', icon: Stethoscope },
  { to: '/doctors', label: 'Doctors', icon: UserCog },
  { to: '/procedures', label: 'Procedure List', icon: ListChecks },
];

function SidebarContent({ isAdmin, isSuperadmin, settings, onNavigate }) {
  return (
    <>
      <div className="px-5 py-5 border-b border-slate-100 flex items-center gap-3">
        <Logo settings={settings} width={40} height={40} />
        <div className="min-w-0">
          <div className="text-brand-700 font-bold text-lg leading-tight truncate">{settings?.clinicName || 'Rizvi Diagnostic'}</div>
          <div className="text-xs text-slate-400">Center Management</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClass} onClick={onNavigate}>
            <Icon size={18} strokeWidth={2} />
            {label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-4 text-xs uppercase tracking-wide text-slate-400 font-semibold">
              Admin
            </div>
            <NavLink to="/users" className={linkClass} onClick={onNavigate}>
              <ShieldCheck size={18} strokeWidth={2} /> Users
            </NavLink>
            <NavLink to="/settings" className={linkClass} onClick={onNavigate}>
              <SettingsIcon size={18} strokeWidth={2} /> Practice Settings
            </NavLink>
          </>
        )}

        {isSuperadmin && (
          <>
            <div className="pt-4 pb-1 px-4 text-xs uppercase tracking-wide text-amber-500 font-semibold">
              Superadmin
            </div>
            <NavLink to="/site-control" className={linkClass} onClick={onNavigate}>
              <Power size={18} strokeWidth={2} /> Site Control
            </NavLink>
          </>
        )}
      </nav>

      <div className="p-4 text-xs text-slate-400 border-t border-slate-100">
        {settings?.address || '547-A Jinnah Colony Faisalabad'}<br />
        {settings?.phone1}{settings?.phone2 ? ` · ${settings.phone2}` : ''}
      </div>
    </>
  );
}

export default function Sidebar({ mobileOpen, onClose }) {
  const { isAdmin, isSuperadmin } = useAuth();
  const { settings } = useSettings();

  return (
    <>
      {/* Desktop: fixed column */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 h-screen sticky top-0 flex-col">
        <SidebarContent isAdmin={isAdmin} isSuperadmin={isSuperadmin} settings={settings} />
      </aside>

      {/* Mobile: off-canvas drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85%] bg-white flex flex-col shadow-xl transition-transform duration-200 ease-out">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
              aria-label="Close menu"
            >
              <X size={22} />
            </button>
            <SidebarContent isAdmin={isAdmin} isSuperadmin={isSuperadmin} settings={settings} onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}