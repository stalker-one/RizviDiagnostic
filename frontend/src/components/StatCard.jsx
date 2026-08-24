import React from 'react';
import useCountUp from '../hooks/useCountUp.js';

const ACCENT_CLASSES = {
  brand: { text: 'text-brand-700', icon: 'bg-brand-50 text-brand-600', ring: 'border-brand-100' },
  green: { text: 'text-emerald-700', icon: 'bg-emerald-50 text-emerald-600', ring: 'border-emerald-100' },
  red: { text: 'text-red-700', icon: 'bg-red-50 text-red-600', ring: 'border-red-100' },
  amber: { text: 'text-amber-700', icon: 'bg-amber-50 text-amber-600', ring: 'border-amber-100' },
};

export default function StatCard({ label, value, sub, accent = 'brand', prefix = '', suffix = '', decimals = 0 }) {
  const numeric = typeof value === 'number' ? value : Number(value);
  const isNumeric = Number.isFinite(numeric);
  const animated = useCountUp(isNumeric ? numeric : 0, 900);
  const tone = ACCENT_CLASSES[accent] || ACCENT_CLASSES.brand;
  const displayValue = isNumeric
    ? `${prefix}${animated.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
    : value;

  return (
    <div className={`group relative overflow-hidden rounded-2xl border bg-white p-4 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${tone.ring}`}>
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-slate-50/70 transition-transform duration-300 group-hover:scale-110" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 leading-4">{label}</div>
          <div className={`text-xl sm:text-2xl lg:text-[26px] font-extrabold tracking-tight tabular-nums ${tone.text} truncate`} title={displayValue}>{displayValue}</div>
          {sub && <div className="mt-1 text-xs text-slate-400 truncate" title={sub}>{sub}</div>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.icon}`} aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-current" />
        </div>
      </div>
      <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full w-1/3 rounded-full ${tone.text.replace('text-', 'bg-')}`} /></div>
    </div>
  );
}
