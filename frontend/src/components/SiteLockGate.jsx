import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';

// Shown app-wide (on top of every page, including Login) whenever the
// superadmin has deactivated the site. It cannot be dismissed by anyone
// other than the superadmin, who never sees it in the first place — their
// own sessions are exempt on the backend.
export default function SiteLockGate() {
  const { user } = useAuth();
  const [lock, setLock] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      api
        .get('/site/status')
        .then((res) => {
          if (!cancelled) setLock(res.data?.disabled ? res.data : null);
        })
        .catch(() => {});
    };

    check();
    // Poll periodically so a session sitting idle on a page (not making any
    // other API calls) still picks up the lock shortly after it's switched on.
    const interval = setInterval(check, 20000);

    const onLocked = (e) => setLock(e.detail || { disabled: true, message: 'Service temporarily unavailable.' });
    window.addEventListener('rdc:site-locked', onLocked);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('rdc:site-locked', onLocked);
    };
  }, []);

  // The superadmin is always exempt, no matter what the backend reports.
  // The admin portal itself is also always reachable — otherwise a
  // logged-out superadmin could never get back in to turn the lock off.
  if (!lock || user?.role === 'superadmin' || window.location.pathname === '/adminlogin') return null;

  const isPaymentDue = lock.reason === 'payment_due';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 text-center">
        <div className={`mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center ${isPaymentDue ? 'bg-amber-50' : 'bg-red-50'}`}>
          {isPaymentDue ? (
            <AlertTriangle size={28} className="text-amber-500" />
          ) : (
            <ShieldAlert size={28} className="text-red-500" />
          )}
        </div>
        <h2 className="font-bold text-lg text-slate-800 mb-2">
          {isPaymentDue ? 'Payment Required' : 'Service Unavailable'}
        </h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          {lock.message || 'This system is temporarily unavailable. Please contact your administrator.'}
        </p>
      </div>
    </div>
  );
}
