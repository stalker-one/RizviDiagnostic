import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

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
  // localStorage is deliberately used for the authenticated Android session,
  // not sessionStorage. Capacitor WebView storage survives normal app closes
  // and Android app updates, so staff users do not have to log in every time.
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('rdc_token');

    if (!token) {
      if (mounted) setLoading(false);
      return () => { mounted = false; };
    }

    api
      .get('/auth/me')
      .then((res) => {
        if (!mounted) return;
        // Refresh the cached user from the server while retaining the token.
        setUser(res.data);
        localStorage.setItem('rdc_user', JSON.stringify(res.data));
      })
      .catch((err) => {
        if (!mounted) return;

        // IMPORTANT: Do not log a staff user out because the device is
        // temporarily offline, the API is unreachable, DNS is unavailable,
        // or another non-authentication request failed. The previous code
        // cleared the persistent token for ANY /auth/me error, which made the
        // Android app ask for credentials again after a normal restart or
        // transient network failure.
        //
        // The axios interceptor is responsible for clearing the token on a
        // confirmed HTTP 401. For every other error keep the cached session
        // and let the app continue using the saved login.
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
