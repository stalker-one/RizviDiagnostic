import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
const ANDROID_RELEASE_API = 'https://api.github.com/repos/stalker-one/RizviDiagnostic/releases/tags/android-latest';
const AndroidUpdate = registerPlugin('AndroidUpdate');

function AndroidUpdateModal({ update, onLater, onUpdate, busy, error }) {
  if (!update) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.55)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, borderRadius: 18, background: '#fff', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>Update available</h2>
        <p style={{ margin: '0 0 8px', color: '#555' }}>A newer version of Rizvi Diagnostic Center is available.</p>
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
  const localMutationAt = useRef(0);
  const checkingAndroidUpdate = useRef(false);

  useEffect(() => {
    let stopped = false;

    const onLocalMutation = () => {
      localMutationAt.current = Date.now();
      setRefreshKey((value) => value + 1);
    };

    window.addEventListener('rdc:data-added', onLocalMutation);

    const checkVersion = async () => {
      if (stopped) return;
      try {
        const response = await api.get('/sync/version', {
          params: { _: Date.now() },
          headers: { 'Cache-Control': 'no-cache' },
        });
        const version = Number(response.data?.version || 0);
        if (lastVersion.current === null) {
          lastVersion.current = version;
          return;
        }
        if (version !== lastVersion.current) {
          lastVersion.current = version;
          setRefreshKey((value) => value + 1);
        }
      } catch {
        // Retry automatically on the next poll.
      }
    };

    checkVersion();
    const timer = window.setInterval(checkVersion, REALTIME_INTERVAL_MS);

    let channel = null;
    try {
      if ('BroadcastChannel' in window) {
        channel = new BroadcastChannel('rizvi-diagnostic-realtime');
        channel.onmessage = (event) => {
          if (event.data?.type === 'data-changed') setRefreshKey((value) => value + 1);
        };
      }
    } catch {
      channel = null;
    }

    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('rdc:data-added', onLocalMutation);
      if (channel) channel.close();
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return undefined;

    let cancelled = false;

    const checkAndroidUpdate = async () => {
      if (cancelled || checkingAndroidUpdate.current) return;
      checkingAndroidUpdate.current = true;
      try {
        const installed = await AndroidUpdate.getVersion();
        const response = await fetch(`${ANDROID_RELEASE_API}?_=${Date.now()}`, {
          cache: 'no-store',
          headers: { Accept: 'application/vnd.github+json', 'Cache-Control': 'no-cache' },
        });
        if (!response.ok) throw new Error(`Update check returned HTTP ${response.status}`);
        const release = await response.json();
        if (cancelled || release?.draft) return;

        const apkAsset = Array.isArray(release.assets)
          ? release.assets.find((asset) => /\.apk$/i.test(asset?.name || ''))
          : null;
        if (!apkAsset?.browser_download_url) return;

        const match = String(apkAsset.name).match(/RizviDiagnosticCenter-(\d+)-/i);
        const remoteVersionCode = Number(match?.[1] || release.body?.match(/Version code:\s*(\d+)/i)?.[1] || 0);
        const installedVersionCode = Number(installed?.versionCode || 0);

        if (remoteVersionCode > installedVersionCode && !cancelled) {
          setAndroidUpdate({
            versionCode: remoteVersionCode,
            versionName: release.body?.match(/Version name:\s*([^\n\r]+)/i)?.[1]?.trim() || `1.0.${Math.max(0, remoteVersionCode - 1)}`,
            url: apkAsset.browser_download_url,
          });
        }
      } catch (error) {
        // Update checking is non-blocking; the app remains usable when offline.
        console.warn('Android update check failed:', error);
      } finally {
        checkingAndroidUpdate.current = false;
      }
    };

    checkAndroidUpdate();
    const onResume = () => checkAndroidUpdate();
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    const timer = window.setInterval(checkAndroidUpdate, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, []);

  const installAndroidUpdate = async () => {
    if (!androidUpdate?.url || androidUpdateBusy) return;
    setAndroidUpdateBusy(true);
    setAndroidUpdateError('');
    try {
      await AndroidUpdate.installApk({ url: androidUpdate.url });
    } catch (error) {
      setAndroidUpdateError(error?.message || 'Unable to start the Android update.');
    } finally {
      setAndroidUpdateBusy(false);
    }
  };

  return (
    <>
      <SiteLockGate />
      <div key={refreshKey} className="contents">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/adminlogin" element={<AdminLogin />} />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <AndroidUpdateModal
        update={androidUpdate}
        busy={androidUpdateBusy}
        error={androidUpdateError}
        onLater={() => { setAndroidUpdate(null); setAndroidUpdateError(''); }}
        onUpdate={installAndroidUpdate}
      />
    </>
  );
}
