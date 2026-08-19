import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const lastVersion = useRef(null);
  const localMutationAt = useRef(0);

  useEffect(() => {
    let stopped = false;

    const onLocalMutation = () => {
      // Local create/edit/delete should update the current UI immediately,
      // without waiting for the next polling interval.
      localMutationAt.current = Date.now();
      setRefreshKey((value) => value + 1);
    };

    window.addEventListener('rdc:data-added', onLocalMutation);

    // Cross-window / Android / desktop synchronization. The server returns
    // only a timestamp-like change token, never application data. When another
    // device changes Atlas, the current route is remounted and its existing
    // useEffect loaders fetch the new data automatically — no browser refresh
    // and no manual refresh button required.
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
        // Temporary network failure is deliberately silent. The next poll
        // retries automatically and the app continues using its current data.
      }
    };

    checkVersion();
    const timer = window.setInterval(checkVersion, REALTIME_INTERVAL_MS);

    // BroadcastChannel gives two tabs/windows on the same PC an immediate
    // notification, while the server version polling covers Android and other
    // PCs that are connected to the same Atlas database.
    let channel = null;
    try {
      if ('BroadcastChannel' in window) {
        channel = new BroadcastChannel('rizvi-diagnostic-realtime');
        channel.onmessage = (event) => {
          if (event.data?.type === 'data-changed') {
            setRefreshKey((value) => value + 1);
          }
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
    </>
  );
}
