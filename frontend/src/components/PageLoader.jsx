import React from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import Logo from './Logo.jsx';
import Spinner from './Spinner.jsx';

/**
 * Full-page / full-section branded loading state: clinic logo, a spinner
 * ring wrapped around it, the clinic name, and an optional message
 * underneath (e.g. "Loading invoice..."). Used anywhere a whole page or
 * panel is waiting on data, instead of a bare "Loading..." string.
 */
export default function PageLoader({ message = 'Loading...', fullScreen = false, className = '' }) {
  // useSettings() safely returns null if SettingsProvider isn't mounted yet
  // (e.g. very early in the login flow), so no try/catch is needed here.
  const settings = useSettings()?.settings;
  const clinicName = settings?.clinicName || 'Rizvi Diagnostic Center';

  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${
        fullScreen ? 'h-screen w-full' : 'py-16'
      } ${className}`}
    >
      <div className="relative flex items-center justify-center">
        <span className="absolute inline-flex h-16 w-16 rounded-2xl border-2 border-brand-200 border-t-brand-600 animate-spin" />
        <div className="h-12 w-12 flex items-center justify-center rounded-xl overflow-hidden bg-white shadow-sm">
          <Logo settings={settings} width={40} height={40} />
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold text-slate-700">{clinicName}</div>
        <div className="mt-1 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Spinner size={12} tone="brand" />
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
}
