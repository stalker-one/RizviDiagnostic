import React, { useEffect, useState } from 'react';
import { Fingerprint, ShieldCheck, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import { getBiometricStatus, enableBiometricLogin, disableBiometricLogin, loginWithBiometric } from '../utils/biometricAuth.js';

export default function BiometricAccess() {
  const location = useLocation();
  const [status, setStatus] = useState({ available: false, enabled: false, code: null, message: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);

  const isLogin = location.pathname === '/login' || location.pathname === '/adminlogin';
  const isProfile = location.pathname === '/profile';

  const refresh = async () => {
    if (!isLogin && !isProfile) return;
    const next = await getBiometricStatus();
    setStatus(next || { available: false, enabled: false });
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
      if (!result?.verified || !result?.token) throw new Error('Biometric verification did not complete. Please try again.');
      localStorage.setItem('rdc_token', result.token);
      const me = await api.get('/auth/me');
      localStorage.setItem('rdc_user', JSON.stringify(me.data));
      window.location.href = me.data.role === 'superadmin' ? '/site-control' : '/dashboard';
    } catch (err) {
      if (err?.response?.status === 401) {
        await disableBiometricLogin().catch(() => {}); await refresh();
        setMessage('Your saved login session has expired. Sign in with your password and enable fingerprint login again.');
      } else {
        const text = err?.message || 'Biometric verification failed. Please try again.';
        if (!/cancel|negative|use password/i.test(text)) setMessage(text);
      }
    } finally { setBusy(false); }
  };

  const enable = async () => {
    const token = localStorage.getItem('rdc_token');
    if (!token) { setMessage('Please sign in with your password first.'); return; }
    setBusy(true);
    setMessage('Android will open its biometric prompt. Follow the prompt and use your enrolled fingerprint wherever your phone sensor is located.');
    try {
      const result = await enableBiometricLogin(token);
      if (!result?.verified || !result?.enabled) throw new Error('Biometric verification was not completed. Fingerprint login was not enabled.');
      const next = await getBiometricStatus();
      setStatus(next || { available: true, enabled: true });
      if (!next?.enabled) throw new Error('Android did not confirm the secure biometric setup. Fingerprint login was not enabled.');
      setMessage('Fingerprint verified successfully. Fingerprint login is now enabled on this device.');
    } catch (err) {
      setMessage(err?.message || 'Biometric verification failed. Fingerprint login was not enabled.');
      await refresh();
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true); setMessage('');
    try { await disableBiometricLogin(); await refresh(); setMessage('Fingerprint login has been disabled.'); }
    catch (err) { setMessage(err?.message || 'Could not disable fingerprint login.'); }
    finally { setBusy(false); }
  };

  if ((!isLogin && !isProfile) || !status.available) return null;

  if (isLogin && status.enabled) {
    return (
      <div className="fixed left-4 right-4 bottom-4 z-[100000] sm:left-auto sm:right-6 sm:w-[360px]">
        <div className="rounded-2xl border border-blue-100 bg-white/95 backdrop-blur shadow-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><Fingerprint size={25} /></div>
            <div className="flex-1 min-w-0"><div className="font-bold text-slate-800 text-sm">Fingerprint Login</div><div className="text-xs text-slate-500">Verify your fingerprint to sign in securely.</div></div>
            <button type="button" onClick={biometricLogin} disabled={busy} className="shrink-0 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? 'Verifying...' : 'Use Fingerprint'}</button>
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
            <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><Fingerprint size={23} /></div><div className="flex-1"><div className="font-bold">Fingerprint Login</div><div className="text-xs text-white/70">Secure biometric verification for this Android device</div></div><button type="button" onClick={() => setVisible(false)} disabled={busy} className="p-1 text-white/70 hover:text-white"><X size={19} /></button></div>
            <div className="p-4">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 p-3 mb-3"><ShieldCheck size={19} className={status.enabled ? 'text-emerald-600' : 'text-slate-400'} /><div className="text-sm text-slate-700">{status.enabled ? 'Fingerprint login is enabled and protected by Android biometric verification.' : 'Enable fingerprint login for this device.'}</div></div>
              <button type="button" onClick={status.enabled ? disable : enable} disabled={busy} className={`w-full rounded-xl py-3 text-sm font-bold text-white ${status.enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}>{busy ? 'Verifying...' : status.enabled ? 'Disable Fingerprint Login' : 'Enable Fingerprint Login'}</button>
              {message && <div className={`mt-3 text-xs rounded-lg px-3 py-2 ${/successfully|enabled|disabled/i.test(message) ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>{message}</div>}
              {status.code && status.code !== 0 && <div className="mt-2 text-[11px] text-slate-400">Android biometric status: {status.message || `code ${status.code}`}</div>}
              <p className="mt-3 text-[11px] text-slate-400">The app never stores your password. The Android application uses the system biometric prompt; the phone decides whether the sensor is under the display, on the side/power button, or elsewhere.</p>
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
}
