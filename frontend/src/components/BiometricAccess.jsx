import React, { useEffect, useRef, useState } from 'react';
import { Fingerprint, ShieldCheck, X, CheckCircle2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useLocation } from 'react-router-dom';
import { getBiometricStatus, enableBiometricLogin, disableBiometricLogin, loginWithBiometric } from '../utils/biometricAuth.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isWindowsApp = () => typeof window !== 'undefined' && !!window.electronBiometric;
const isAndroidApp = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export default function BiometricAccess() {
  const location = useLocation();
  const [status, setStatus] = useState({ available: false, enabled: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [visible, setVisible] = useState(false);
  const autoLoginStarted = useRef(false);
  const isLogin = location.pathname === '/login' || location.pathname === '/adminlogin';
  const isProfile = location.pathname === '/profile';
  const windows = isWindowsApp();
  const android = isAndroidApp();
  const title = windows ? 'Windows Hello' : android ? 'Fingerprint Login' : 'Biometric Login';
  const action = windows ? 'Windows Hello' : 'Fingerprint Login';
  const deviceText = windows ? 'Secure Windows Hello verification for this Windows device' : android ? 'Secure fingerprint verification for this Android device' : 'Secure biometric verification for this device';

  const refresh = async () => { if (!isLogin && !isProfile) return null; try { const next = await getBiometricStatus(); setStatus(next || { available: false, enabled: false }); return next; } catch { setStatus({ available: false, enabled: false }); return null; } };
  useEffect(() => { setMessage(''); setSuccess(false); setVisible(false); autoLoginStarted.current = false; refresh(); }, [location.pathname]);

  const biometricLogin = async () => {
    if (busy) return;
    setBusy(true); setMessage('Verifying your fingerprint...'); setSuccess(false);
    try {
      const result = await loginWithBiometric();
      if (!result?.verified || !result?.token) throw new Error('Fingerprint verification was not completed. Continue with your email and password.');
      localStorage.setItem('rdc_token', result.token);
      if (result.user) localStorage.setItem('rdc_user', JSON.stringify(result.user));
      window.location.replace(result.user?.role === 'superadmin' ? '/site-control' : '/dashboard');
    } catch (err) {
      if (err?.response?.status === 401) { await disableBiometricLogin().catch(() => {}); await refresh(); setMessage('This fingerprint login is no longer registered. Please continue with your email and password, then enable fingerprint login again.'); }
      else { const text = err?.message || 'Fingerprint verification failed. Please continue with your email and password.'; if (!/cancel|negative|use password/i.test(text)) setMessage(text); else setMessage(''); }
    } finally { setBusy(false); }
  };

  const enable = async () => {
    const token = localStorage.getItem('rdc_token');
    if (!token) { setMessage('Please sign in with your email and password first.'); return; }
    if (busy) return;
    setBusy(true); setSuccess(false); setMessage(android ? 'Confirm your enrolled fingerprint in the Android system prompt.' : 'Confirm your biometric identity in the system prompt.');
    try {
      const result = await enableBiometricLogin(token);
      if (!result?.verified || !result?.enabled) throw new Error(`${action} verification was not completed. ${action} was not enabled.`);
      const next = await getBiometricStatus();
      if (!next?.enabled) throw new Error(`The system did not confirm secure ${action} setup.`);
      setStatus(next); setSuccess(true); setMessage(`${action} added successfully.`);
      await sleep(1200);
      setMessage(`${action} added successfully. Signing you out securely...`);
      await sleep(700);
      localStorage.removeItem('rdc_token'); localStorage.removeItem('rdc_user'); sessionStorage.clear();
      window.location.replace('/login?biometric=ready');
    } catch (err) { setSuccess(false); setMessage(err?.message || `${action} verification failed. ${action} was not enabled.`); await refresh(); }
    finally { setBusy(false); }
  };

  const disable = async () => { if (busy) return; setBusy(true); setMessage(''); setSuccess(false); try { await disableBiometricLogin(); await refresh(); setMessage(`${action} has been disabled.`); } catch (err) { setMessage(err?.message || `Could not disable ${action}.`); } finally { setBusy(false); } };

  useEffect(() => {
    if (!isLogin || autoLoginStarted.current) return;
    const params = new URLSearchParams(location.search);
    if (params.get('biometric') !== 'ready' || !status.available || !status.enabled) return;
    autoLoginStarted.current = true;
    setSuccess(true); setMessage(`${action} added successfully. Signing you in...`);
    const timer = setTimeout(() => biometricLogin(), 700);
    return () => clearTimeout(timer);
  }, [isLogin, location.search, status.available, status.enabled]);

  if ((!isLogin && !isProfile) || !status.available) return null;
  if (isLogin) return <div className="fixed left-4 right-4 bottom-4 z-[100000] sm:left-auto sm:right-6 sm:w-[380px]"><div className="rounded-2xl border border-blue-100 bg-white/95 backdrop-blur shadow-2xl p-4"><div className="flex items-center gap-3"><div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><Fingerprint size={25} /></div><div className="flex-1 min-w-0"><div className="font-bold text-slate-800 text-sm">{title}</div><div className="text-xs text-slate-500">Use your enrolled {windows ? 'Windows Hello credential' : 'fingerprint'} to sign in securely.</div></div></div>{status.enabled && <button type="button" onClick={biometricLogin} disabled={busy} className="w-full mt-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 text-sm font-semibold disabled:opacity-50">{busy ? `Verifying ${windows ? 'Windows Hello' : 'fingerprint'}...` : `Use ${title}`}</button>}{message && <div className={`mt-3 text-xs rounded-lg px-3 py-2 ${success ? 'text-emerald-700 bg-emerald-50' : 'text-amber-800 bg-amber-50'}`}>{message}</div>}{!status.enabled && <div className="mt-2 text-xs text-slate-500">Fingerprint login is not enabled. Continue below with your email and password.</div>}</div></div>;

  return <div className="fixed left-4 right-4 bottom-4 z-[100000] sm:left-auto sm:right-6 sm:w-[390px]">{!visible ? <button type="button" onClick={() => setVisible(true)} className="ml-auto flex items-center gap-2 rounded-full bg-slate-900 text-white shadow-2xl px-4 py-3 text-sm font-semibold hover:bg-slate-800"><Fingerprint size={18} /> {title}</button> : <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"><div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><Fingerprint size={23} /></div><div className="flex-1"><div className="font-bold">{title}</div><div className="text-xs text-white/70">{deviceText}</div></div><button type="button" onClick={() => setVisible(false)} disabled={busy} className="p-1 text-white/70 hover:text-white"><X size={19} /></button></div><div className="p-4"><div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 p-3 mb-3"><ShieldCheck size={19} className={status.enabled ? 'text-emerald-600' : 'text-slate-400'} /><div className="text-sm text-slate-700">{status.enabled ? `${title} is enabled and protected by secure ${windows ? 'Windows Hello' : 'Android biometric'} verification.` : `Enable ${title} for this device.`}</div></div><button type="button" onClick={status.enabled ? disable : enable} disabled={busy} className={`w-full rounded-xl py-3 text-sm font-bold text-white ${status.enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}>{busy ? 'Verifying...' : status.enabled ? `Disable ${title}` : `Enable ${title}`}</button>{message && <div className={`mt-3 text-xs rounded-lg px-3 py-2 flex items-start gap-2 ${success ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>{success && <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}<span>{message}</span></div>}<p className="mt-3 text-[11px] text-slate-400">The app never stores your password. {windows ? 'Windows Hello uses the secure Windows system authenticator on this PC.' : "Android's system biometric prompt handles the sensor location, including under-display, side/power-button, and rear fingerprint sensors."}</p></div></div>}</div>;
}
