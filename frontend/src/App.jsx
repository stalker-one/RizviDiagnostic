import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import SiteLockGate from './components/SiteLockGate.jsx';

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

export default function App() {
  return (
    <>
      <SiteLockGate />
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
    </>
  );
}
