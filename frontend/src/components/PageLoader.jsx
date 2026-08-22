import React from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import Logo from './Logo.jsx';

/**
 * Full-page / full-section branded loading state: clinic logo inside a
 * softly spinning gradient ring, the clinic name, and an optional message
 * with a small animated dot trio underneath (e.g. "Loading invoice...").
 * Used anywhere a whole page or panel is waiting on data, instead of a
 * bare "Loading..." string.
 */
export default function PageLoader({ message = 'Loading...', fullScreen = false, className = '' }) {
  // useSettings() safely returns null if SettingsProvider isn't mounted yet
  // (e.g. very early in the login flow), so no try/catch is needed here.
  const settings = useSettings()?.settings;
  const clinicName = settings?.clinicName || 'Rizvi Diagnostic Center';

  return (
    <div
      className={`flex flex-col items-center justify-center gap-5 ${
        fullScreen ? 'h-screen w-full' : 'py-16'
      } ${className}`}
    >
      <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
        <span
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            background: 'conic-gradient(from 0deg, #0f6fde, #5fd0dd, #0f6fde)',
            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
            animationDuration: '1.1s',
          }}
        />
        <div className="absolute inset-[7px] rounded-full bg-white shadow-sm flex items-center justify-center animate-pulse" style={{ animationDuration: '1.8s' }}>
          <Logo settings={settings} width={38} height={38} />
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold text-slate-700">{clinicName}</div>
        <div className="mt-1.5 flex items-center justify-center gap-2 text-xs text-slate-400">
          <span>{message}</span>
          <span className="flex items-center gap-0.5">
            <span className="h-1 w-1 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="h-1 w-1 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '120ms' }} />
            <span className="h-1 w-1 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '240ms' }} />
          </span>
        </div>
      </div>
    </div>
  );
}
