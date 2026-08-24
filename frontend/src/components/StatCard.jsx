import React from 'react';
import useCountUp from '../hooks/useCountUp.js';

const ACCENT_CLASSES = {
  brand: { text: 'text-brand-700', icon: 'bg-brand-50 text-brand-600', ring: 'border-brand-100', bar: 'bg-brand-500' },
  green: { text: 'text-emerald-700', icon: 'bg-emerald-50 text-emerald-600', ring: 'border-emerald-100', bar: 'bg-emerald-500' },
  red: { text: 'text-red-700', icon: 'bg-red-50 text-red-600', ring: 'border-red-100', bar: 'bg-red-500' },
  amber: { text: 'text-amber-700', icon: 'bg-amber-50 text-amber-600', ring: 'border-amber-100', bar: 'bg-amber-500' },
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
    <div className="dashboard-card-enter group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-[0_6px_24px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_35px_rgba(15,23,42,0.12)]">
      <div className="dashboard-card-glow absolute -right-10 -top-10 h-28 w-28 rounded-full bg-slate-50 transition-transform duration-500 group-hover:scale-150" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 leading-4">{label}</div>
          <div className={`dashboard-value text-xl sm:text-2xl lg:text-[26px] font-extrabold tracking-tight tabular-nums ${tone.text} truncate`} title={displayValue}>{displayValue}</div>
          {sub && <div className="mt-1 text-xs text-slate-400 truncate" title={sub}>{sub}</div>}
        </div>
        <div className={`dashboard-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.icon}`} aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-current" />
        </div>
      </div>
      <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`dashboard-card-bar h-full w-1/3 rounded-full ${tone.bar}`} />
      </div>
      <style>{`@keyframes dashboardCardIn{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes dashboardGlow{from{opacity:.45;transform:translateX(10px)}to{opacity:1;transform:translateX(0)}}@keyframes dashboardBar{from{transform:scaleX(0);transform-origin:left}to{transform:scaleX(1);transform-origin:left}}.dashboard-card-enter{animation:dashboardCardIn .55s cubic-bezier(.22,1,.36,1) both}.dashboard-card-enter:nth-child(2){animation-delay:.06s}.dashboard-card-enter:nth-child(3){animation-delay:.12s}.dashboard-card-enter:nth-child(4){animation-delay:.18s}.dashboard-card-enter:nth-child(5){animation-delay:.24s}.dashboard-card-enter:nth-child(6){animation-delay:.30s}.dashboard-card-enter:nth-child(7){animation-delay:.36s}.dashboard-card-icon{animation:dashboardGlow .65s ease-out both}.dashboard-card-bar{animation:dashboardBar .9s cubic-bezier(.22,1,.36,1) .25s both}@media(prefers-reduced-motion:reduce){.dashboard-card-enter,.dashboard-card-icon,.dashboard-card-bar{animation:none!important}.dashboard-card-enter{transition:none!important}}`}</style>
    </div>
  );
}
