import React from 'react';
import Spinner from './Spinner.jsx';

// Solid, tinted "pill" styles for every variant — including the compact
// action buttons used inside table rows (view / edit / delete / etc.),
// which used to render as bare underlined text links and looked out of
// place next to the rest of the UI.
const variants = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-600/20 hover:shadow-md hover:shadow-brand-600/25 focus-visible:ring-brand-500',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 focus-visible:ring-slate-400',
  outline: 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-slate-400',
  danger: 'bg-red-50 hover:bg-red-100 text-red-600 focus-visible:ring-red-400',
  success: 'bg-green-600 hover:bg-green-700 text-white shadow-sm shadow-green-600/20 hover:shadow-md hover:shadow-green-600/25 focus-visible:ring-green-500',
  warning: 'bg-amber-50 hover:bg-amber-100 text-amber-700 focus-visible:ring-amber-400',
  dark: 'bg-slate-800 hover:bg-slate-900 text-white shadow-sm shadow-slate-800/20 hover:shadow-md focus-visible:ring-slate-600',
  // Kept for the rare case a truly plain inline text link is wanted.
  link: 'text-brand-600 hover:underline px-0 py-0 focus-visible:ring-brand-500',
};

const sizes = {
  xs: 'px-2.5 py-1 text-xs',
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-sm',
};

const iconSizes = { xs: 13, sm: 14, md: 16, lg: 18 };

export default function Button({
  as = 'button',
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className = '',
  disabled = false,
  loading = false,
  children,
  ...rest
}) {
  const Component = as;
  const isPlainLink = variant === 'link';
  const base = isPlainLink
    ? 'inline-flex items-center gap-1.5 font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded'
    : 'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 whitespace-nowrap active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1';

  const classes = `${base} ${!isPlainLink ? sizes[size] : ''} ${variants[variant]} ${className}`;
  const isBusy = loading && Component === 'button';

  return (
    <Component
      className={classes}
      disabled={Component === 'button' ? disabled || loading : undefined}
      aria-busy={isBusy || undefined}
      {...rest}
    >
      {loading ? (
        <Spinner
          size={iconSizes[size] || 16}
          className="shrink-0"
          tone={variant === 'primary' || variant === 'success' || variant === 'dark' ? 'light' : 'current'}
        />
      ) : (
        Icon && <Icon size={iconSizes[size] || 16} strokeWidth={2.25} className="shrink-0" />
      )}
      {children}
    </Component>
  );
}