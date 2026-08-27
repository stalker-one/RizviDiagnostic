import React, { useEffect, useState } from 'react';
import { Fingerprint, ShieldCheck, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import { getBiometricStatus, enableBiometricLogin, disableBiometricLogin, loginWithBiometric } from '../utils/biometricAuth.js';

export default function BiometricAccess() {
  const location = useLocation();
  const [status, setStatus] = useState({ available: false, enabled: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);

  const isLogin = location.pathname === '/login' || location.pathname === '/adminlogin';
  const isProfile = location.pathname === '/profile';

  const refresh = async () => {
    if (!isLogin && !isProfile) return;
    const next = await getBiometricStatus();
    setStatus(next);
  };

  useEffect(() => {
    setMessage('');
    setVisible(false);
    refresh();
  }, [location.pathname]);

  const biometricLogin = async () => {
    setBusy(true); setMessage('');
    try {
      const result = await loginWithBiometric();
      if (!result?.token) throw new Error('No saved login session was found.');
      localStorage.setItem('rdc_token', result.token);
      const me = await api.get('/auth/me');
      localStorage.setItem('rdc_user', JSON.stringify(me.data));
      window.location.href = me.data.role === 'superadmin' ? '/site-control' : '/dashboard';
    } catch (err) {
      if (err?.response?.status === 401) {
        try { await disableBiometricLogin(); await refresh(); } catch (_) {}
        setMessage('Your saved login has expired. Please sign in with your password and enable fingerprint login again.');
      } else if (err?.message && !/cancel|negative|use password/i.test(err.message)) {
        setMessage(err.message);
      }
    } finally { setBusy(false); }
  };

  const enable = async () => {
    const token = localStorage.getItem('rdc_token');
    if (!token) { setMessage('Please sign in with your password first.'); return; }
    setBusy(true); setMessage('');
    try {
      await enableBiometricLogin(token);
      setStatus({ ...(await getBiometricStatus()), enabled: true });
      setMessage('Fingerprint login is enabled on this device.');
    } catch (err) { setMessage(err.message || 'Could not enable fingerprint login.'); }
    finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true); setMessage('');
    try { await disableBiometricLogin(); setStatus({ ...(await getBiometricStatus()), enabled: false }); setMessage('Fingerprint login has been disabled.'); }
    catch (err) { setMessage(err.message || 'Could not disable fingerprint login.'); }
    finally { setBusy(false); }
  };

  if ((!isLogin && !isProfile) || !status.available) return null;

  if (isLogin && status.enabled) {
    return (
      <div className="fixed left-4 right-4 bottom-4 z-[100000] sm:left-auto sm:right-6 sm:w-[360px]">
        <div className="rounded-2xl border border-blue-100 bg-white/95 backdrop-blur shadow-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><Fingerprint size={25} /></div>
            <div className="flex-1 min-w-0"><div className="font-bold text-slate-800 text-sm">Fingerprint Login</div><div className="text-xs text-slate-500">Use your saved biometric to sign in securely.</div></div>
            <button type="button" onClick={biometricLogin} disabled={busy} className="shrink-0 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? 'Checking...' : 'Use Fingerprint'}</button>
          </div>
          {message && <div className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{message}</div>}
        </div>
      </div>
    );
  }

  if (isProfile) {
    return (
      <div className="fixed left-4 right-4 bottom-4 z-[100000] sm:left-auto sm:right-6 sm:w-[390px]">
        {!visible ? (
          <button type="button" onClick={() => setVisible(true)} className="ml-auto flex items-center gap-2 rounded-full bg-slate-900 text-white shadow-2xl px-4 py-3 text-sm font-semibold hover:bg-slate-800"><Fingerprint size={18} /> Fingerprint Login</button>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><Fingerprint size={23} /></div><div className="flex-1"><div className="font-bold">Fingerprint Login</div><div className="text-xs text-white/70">Secure quick login for this Android device</div></div><button type="button" onClick={() => setVisible(false)} className="p-1 text-white/70 hover:text-white"><X size={19} /></button></div>
            <div className="p-4">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 p-3 mb-3"><ShieldCheck size={19} className="text-emerald-600" /><div className="text-sm text-slate-700">{status.enabled ? 'Fingerprint login is currently enabled.' : 'Enable fingerprint login for this device.'}</div></div>
              <button type="button" onClick={status.enabled ? disable : enable} disabled={busy} className={`w-full rounded-xl py-3 text-sm font-bold text-white ${status.enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}>{busy ? 'Please wait...' : status.enabled ? 'Disable Fingerprint Login' : 'Enable Fingerprint Login'}</button>
              {message && <div className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{message}</div>}
              <p className="mt-3 text-[11px] text-slate-400">Your password is never stored by the web app. The Android application stores only an encrypted login session inside the Android app sandbox and requires Android biometric verification before releasing it.</p>
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
}
