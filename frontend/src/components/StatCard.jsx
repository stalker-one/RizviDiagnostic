import React from 'react';
import useCountUp from '../hooks/useCountUp.js';

const ACCENT_CLASSES = {
  brand: 'text-brand-700',
  green: 'text-green-700',
  red: 'text-red-600',
  amber: 'text-amber-600',
};

export default function StatCard({ label, value, sub, accent = 'brand', prefix = '', suffix = '', decimals = 0 }) {
  const numeric = typeof value === 'number' ? value : Number(value);
  const isNumeric = Number.isFinite(numeric);
  const animated = useCountUp(isNumeric ? numeric : 0, 900);

  const displayValue = isNumeric
    ? `${prefix}${animated.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`
    : value;

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 transition-shadow hover:shadow-md">
      <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${ACCENT_CLASSES[accent] || ACCENT_CLASSES.brand}`}>
        {displayValue}
      </div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}
