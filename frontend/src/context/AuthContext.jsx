import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import { syncBiometricToken } from '../utils/biometricAuth.js';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem('rdc_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem('rdc_user');
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('rdc_token');
    if (!token) {
      if (mounted) setLoading(false);
      return () => { mounted = false; };
    }

    api.get('/auth/me')
      .then((res) => {
        if (!mounted) return;
        setUser(res.data);
        localStorage.setItem('rdc_user', JSON.stringify(res.data));
      })
      .catch((err) => {
        if (!mounted) return;
        if (err?.response?.status !== 401) {
          const cachedUser = readStoredUser();
          if (cachedUser) setUser(cachedUser);
          return;
        }
        localStorage.removeItem('rdc_token');
        localStorage.removeItem('rdc_user');
        setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  const login = async (email, password, portal) => {
    const res = await api.post('/auth/login', { email, password, portal });
    localStorage.setItem('rdc_token', res.data.token);
    localStorage.setItem('rdc_user', JSON.stringify(res.data.user));
    setUser(res.data.user);

    // Password login remains a valid fallback. If biometric login is already
    // enabled, replace its encrypted session with this newly authenticated
    // account instead of disabling the feature.
    await syncBiometricToken(res.data.token);
    return res.data.user;
  };

  const logout = () => {
    // Keep the enrolled biometric credential available so the next login can
    // use Android fingerprint authentication. Disabling is an explicit action
    // in Profile, not a side effect of ordinary logout.
    localStorage.removeItem('rdc_token');
    localStorage.removeItem('rdc_user');
    setUser(null);
  };

  const impersonate = async (userId) => {
    const res = await api.post(`/auth/impersonate/${userId}`);
    localStorage.setItem('rdc_token', res.data.token);
    localStorage.setItem('rdc_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    await syncBiometricToken(res.data.token);
    return res.data.user;
  };

  const stopImpersonating = async () => {
    const res = await api.post('/auth/stop-impersonate');
    localStorage.setItem('rdc_token', res.data.token);
    localStorage.setItem('rdc_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    await syncBiometricToken(res.data.token);
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
