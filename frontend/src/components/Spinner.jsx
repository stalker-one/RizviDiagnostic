import React from 'react';

/**
 * Lightweight inline spinner (a rotating ring built from a single SVG
 * circle with a dashed stroke). Used inside buttons and next to short
 * "Loading..." labels. For a full section/page loading state with the
 * clinic logo, use <PageLoader /> instead.
 */
export default function Spinner({ size = 16, className = '', tone = 'current' }) {
  const toneClass = tone === 'light' ? 'text-white' : tone === 'brand' ? 'text-brand-600' : 'text-current';

  return (
    <svg
      className={`animate-spin ${toneClass} ${className}`}
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="status"
      aria-label="Loading"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5" />
      <path
        d="M22 12c0-5.523-4.477-10-10-10"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
