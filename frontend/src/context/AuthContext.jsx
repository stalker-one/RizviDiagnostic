import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('rdc_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('rdc_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data);
        localStorage.setItem('rdc_user', JSON.stringify(res.data));
      })
      .catch(() => {
        localStorage.removeItem('rdc_token');
        localStorage.removeItem('rdc_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password, portal) => {
    const res = await api.post('/auth/login', { email, password, portal });
    localStorage.setItem('rdc_token', res.data.token);
    localStorage.setItem('rdc_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('rdc_token');
    localStorage.removeItem('rdc_user');
    setUser(null);
  };

  // Superadmin: log in as any admin/staff account to book, create invoices,
  // or add patients exactly as that user would. The new (impersonated)
  // session's token carries `impersonatedBy` so a banner can be shown and
  // the superadmin can hand the session back with stopImpersonating().
  const impersonate = async (userId) => {
    const res = await api.post(`/auth/impersonate/${userId}`);
    localStorage.setItem('rdc_token', res.data.token);
    localStorage.setItem('rdc_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const stopImpersonating = async () => {
    const res = await api.post('/auth/stop-impersonate');
    localStorage.setItem('rdc_token', res.data.token);
    localStorage.setItem('rdc_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const updateProfile = async ({ name, phone }) => {
    const res = await api.put('/auth/profile', { name, phone });
    localStorage.setItem('rdc_token', res.data.token);
    localStorage.setItem('rdc_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        updateProfile,
        loading,
        // "isAdmin" covers both admin and superadmin — anywhere the app
        // already gates a feature on isAdmin, the superadmin sees it too.
        isAdmin: user?.role === 'admin' || user?.role === 'superadmin',
        isSuperadmin: user?.role === 'superadmin',
        isImpersonating: !!user?.impersonatedBy,
        impersonate,
        stopImpersonating,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
