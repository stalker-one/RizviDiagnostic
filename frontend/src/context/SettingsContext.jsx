import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/axios';

const SettingsContext = createContext(null);
const REFRESH_MS = 3000;

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    return api.get('/settings', { params: { _: Date.now() }, headers: { 'Cache-Control': 'no-cache' } })
      .then((res) => setSettings(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);

  return <SettingsContext.Provider value={{ settings, loading, refresh, setSettings }}>{children}</SettingsContext.Provider>;
}

export function useSettings() { return useContext(SettingsContext); }
