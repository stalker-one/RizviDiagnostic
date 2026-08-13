import React from 'react';

/**
 * Renders the clinic logo using the width/height configured by the admin in
 * Practice Settings. Falls back to a plain "R" monogram badge if no logo has
 * been uploaded yet, so layouts never show a broken image.
 */
export default function Logo({ settings, width, height, className = '', rounded = true }) {
  const w = width || settings?.logoWidth || 44;
  const h = height || settings?.logoHeight || 44;

  if (settings?.logoUrl) {
    return (
      <img
        src={settings.logoUrl}
        alt={settings?.clinicName || 'Clinic logo'}
        style={{ width: w, height: h, objectFit: 'contain' }}
        className={className}
      />
    );
  }

  return (
    <div
      style={{ width: w, height: h }}
      className={`${rounded ? 'rounded-xl' : ''} bg-brand-600 text-white flex items-center justify-center font-bold ${className}`}
    >
      <span style={{ fontSize: Math.max(12, Math.min(w, h) * 0.45) }}>
        {(settings?.clinicName || 'R').charAt(0)}
      </span>
    </div>
  );
}
