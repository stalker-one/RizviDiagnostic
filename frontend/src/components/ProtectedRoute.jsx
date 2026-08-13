import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PageLoader from './PageLoader.jsx';

export default function ProtectedRoute({ children, adminOnly = false, superadminOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader fullScreen message="Checking your session..." />;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (superadminOnly && user.role !== 'superadmin') return <Navigate to="/dashboard" replace />;
  if (adminOnly && user.role !== 'admin' && user.role !== 'superadmin') return <Navigate to="/dashboard" replace />;

  return children;
}
