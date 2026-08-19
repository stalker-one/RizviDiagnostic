import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor, registerPlugin } from '@capacitor/core';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import SiteLockGate from './components/SiteLockGate.jsx';
import api from './api/axios';

import Login from './pages/Login.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import Home from './pages/Home.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Patients from './pages/Patients.jsx';
import PatientDetail from './pages/PatientDetail.jsx';
import CreateInvoice from './pages/CreateInvoice.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoicePrint from './pages/InvoicePrint.jsx';
import RadiologyReports from './pages/RadiologyReports.jsx';
import Analytics from './pages/Analytics.jsx';
import Referrals from './pages/Referrals.jsx';
import Doctors from './pages/Doctors.jsx';
import Procedures from './pages/Procedures.jsx';
import Users from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';
import Profile from './pages/Profile.jsx';
import SiteControl from './pages/SiteControl.jsx';

const REALTIME_INTERVAL_MS = 1500;
const AndroidUpdate = registerPlugin('AndroidUpdate');
const IS_SUPERADMIN_APP = import.meta.env.VITE_SUPERADMIN_APP === 'true';

/*
 * IMPORTANT: The Superadmin APK must not force every route back to /adminlogin.
 * Authentication is handled by ProtectedRoute/AuthContext. This guard only
 * prevents an unauthenticated native Superadmin app from opening arbitrary
 * public routes; it never redirects an already-authenticated user.
 */
function SuperadminGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('rdc_token');
  const publicRoutes = ['/adminlogin'];

  useEffect(() => {
    if (!IS_SUPERADMIN_APP) return;
    if (!token && !publicRoutes.includes(location.pathname)) {
      navigate('/adminlogin', { replace: true });
    }
  }, [location.pathname, navigate, token]);

  return null;
}

function AndroidUpdateModal({ update, onLater, onUpdate, busy, error }) {
  if (!update) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.55)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, borderRadius: 18, background: '#fff', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>Update available</h2>
        <p style={{ margin: '0 0 8px', color: '#555' }}>A newer version of {IS_SUPERADMIN_APP ? 'Rizvi Diagnostic Center Superadmin' : 'Rizvi Diagnostic Center'} is available.</p>
        <p style={{ margin: '0 0 16px', fontWeight: 600 }}>Version {update.versionName || update.versionCode}</p>
        {busy && <p style={{ margin: '0 0 12px', color: '#555' }}>Downloading update…</p>}
        {error && <p style={{ margin: '0 0 12px', color: '#b91c1c', fontSize: 14 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onLater} disabled={busy} style={{ border: '1px solid #ddd', borderRadius: 10, padding: '10px 16px', background: '#fff' }}>Later</button>
          <button type="button" onClick={onUpdate} disabled={busy} style={{ border: 0, borderRadius: 10, padding: '10px 16px', background: '#111827', color: '#fff', fontWeight: 600 }}>{busy ? 'Updating…' : 'Update now'}</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [androidUpdate, setAndroidUpdate] = useState(null);
  const [androidUpdateBusy, setAndroidUpdateBusy] = useState(false);
  const [androidUpdateError, setAndroidUpdateError] = useState('');
  const lastVersion = useRef(null);
  const checkingAndroidUpdate = useRef(false);

  useEffect(() => {
    let stopped = false;
    const checkVersion = async () => {
      if (stopped) return;
      try {
        const response = await api.get('/sync/version', { params: { _: Date.now() }, headers: { 'Cache-Control': 'no-cache' } });
        const version = Number(response.data?.version || 0);
        if (lastVersion.current === null) lastVersion.current = version;
        else if (version !== lastVersion.current) { lastVersion.current = version; setRefreshKey((value) => value + 1); }
      } catch { /* retry */ }
    };
    checkVersion();
    const timer = window.setInterval(checkVersion, REALTIME_INTERVAL_MS);
    return () => { stopped = true; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return undefined;
    let cancelled = false;
    const checkAndroidUpdate = async () => {
      if (cancelled || checkingAndroidUpdate.current) return;
      checkingAndroidUpdate.current = true;
      try {
        const installed = await AndroidUpdate.getVersion();
        const tag = IS_SUPERADMIN_APP ? 'android-superadmin-latest' : 'android-latest';
        const response = await fetch(`https://api.github.com/repos/stalker-one/RizviDiagnostic/releases/tags/${tag}?_=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json', 'Cache-Control': 'no-cache' } });
        if (!response.ok) throw new Error(`Update check returned HTTP ${response.status}`);
        const release = await response.json();
        const apkAsset = Array.isArray(release.assets) ? release.assets.find((asset) => /\.apk$/i.test(asset?.name || '')) : null;
        if (!apkAsset?.browser_download_url || cancelled || release?.draft) return;
        const match = String(apkAsset.name).match(/-(\d+)-/);
        const remoteVersionCode = Number(match?.[1] || release.body?.match(/Version code:\s*(\d+)/i)?.[1] || 0);
        if (remoteVersionCode > Number(installed?.versionCode || 0)) {
          setAndroidUpdate({ versionCode: remoteVersionCode, versionName: release.body?.match(/Version name:\s*([^\n\r]+)/i)?.[1]?.trim() || `1.0.${Math.max(0, remoteVersionCode - 1)}`, url: apkAsset.browser_download_url });
        }
      } catch (error) { console.warn('Android update check failed:', error); }
      finally { checkingAndroidUpdate.current = false; }
    };
    checkAndroidUpdate();
    const onResume = () => checkAndroidUpdate();
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    const timer = window.setInterval(checkAndroidUpdate, 5 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', onResume); window.removeEventListener('focus', onResume); };
  }, []);

  const installAndroidUpdate = async () => {
    if (!androidUpdate?.url || androidUpdateBusy) return;
    setAndroidUpdateBusy(true); setAndroidUpdateError('');
    try { await AndroidUpdate.installApk({ url: androidUpdate.url }); }
    catch (error) { setAndroidUpdateError(error?.message || 'Unable to start the Android update.'); }
    finally { setAndroidUpdateBusy(false); }
  };

  const protectedRoutes = (
    <>
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
      <Route path="/patients/:id" element={<ProtectedRoute><PatientDetail /></ProtectedRoute>} />
      <Route path="/invoices/create" element={<ProtectedRoute><CreateInvoice /></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
      <Route path="/invoices/:id/print" element={<ProtectedRoute><InvoicePrint /></ProtectedRoute>} />
      <Route path="/radiology-reports" element={<ProtectedRoute><RadiologyReports /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
      <Route path="/doctors" element={<ProtectedRoute><Doctors /></ProtectedRoute>} />
      <Route path="/procedures" element={<ProtectedRoute><Procedures /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
      <Route path="/site-control" element={<ProtectedRoute superadminOnly><SiteControl /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    </>
  );

  const routes = IS_SUPERADMIN_APP ? (
    <Routes>
      <Route path="/adminlogin" element={<AdminLogin />} />
      {protectedRoutes}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  ) : (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/adminlogin" element={<AdminLogin />} />
      {protectedRoutes}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  return (
    <>
      <SiteLockGate />
      {IS_SUPERADMIN_APP && <SuperadminGuard />}
      <div key={refreshKey} className="contents">{routes}</div>
      <AndroidUpdateModal update={androidUpdate} busy={androidUpdateBusy} error={androidUpdateError} onLater={() => { setAndroidUpdate(null); setAndroidUpdateError(''); }} onUpdate={installAndroidUpdate} />
    </>
  );
}
