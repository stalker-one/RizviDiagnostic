import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Pencil, Trash2, X } from 'lucide-react';
import { useSettings } from '../context/SettingsContext.jsx';

// Visuals per action type, so an add/update/delete toast is distinguishable
// at a glance instead of every confirmation looking identical.
const ACTION_STYLES = {
  added: { Icon: CheckCircle2, iconClass: 'text-green-600', barClass: 'bg-green-500' },
  updated: { Icon: Pencil, iconClass: 'text-blue-600', barClass: 'bg-blue-500' },
  deleted: { Icon: Trash2, iconClass: 'text-red-600', barClass: 'bg-red-500' },
  error: { Icon: AlertTriangle, iconClass: 'text-red-600', barClass: 'bg-red-500' },
};
const DEFAULT_STYLE = ACTION_STYLES.added;

// Fire-and-forget helper for error messages, replacing window.alert().
// Errors bypass the "notificationsEnabled" setting (a user must see failures)
// and stay onscreen a bit longer than normal success toasts.
export function showError(message) {
  window.dispatchEvent(
    new CustomEvent('rdc:data-added', { detail: { message, action: 'error' } })
  );
}

// Screen-edge placement classes, keyed by the value stored in
// settings.notificationPosition (only a superadmin can change this —
// see Settings.jsx "Toast Notifications" tab and the backend PUT /settings).
const POSITION_CLASSES = {
  'top-right': 'top-4 right-4 items-end',
  'top-left': 'top-4 left-4 items-start',
  'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
  'bottom-right': 'bottom-4 right-4 items-end',
  'bottom-left': 'bottom-4 left-4 items-start',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
};

const ANIM_CLASSES = {
  'top-right': 'toast-in-right',
  'bottom-right': 'toast-in-right',
  'top-left': 'toast-in-left',
  'bottom-left': 'toast-in-left',
  'top-center': 'toast-in-down',
  'bottom-center': 'toast-in-up',
};

let idCounter = 0;

export default function ToastContainer() {
  const { settings } = useSettings();
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback(
    (message, action) => {
      const id = ++idCounter;
      setToasts((list) => [...list, { id, message, action }]);
      timers.current[id] = setTimeout(() => dismiss(id), action === 'error' ? 6000 : 4000);
    },
    [dismiss]
  );

  useEffect(() => {
    const onDataAdded = (e) => {
      // Errors must always be visible, even if success notifications are disabled.
      if (settings?.notificationsEnabled === false && e.detail?.action !== 'error') return;
      push(e.detail?.message || 'Saved successfully', e.detail?.action);
    };
    window.addEventListener('rdc:data-added', onDataAdded);
    return () => window.removeEventListener('rdc:data-added', onDataAdded);
  }, [push, settings?.notificationsEnabled]);

  useEffect(
    () => () => {
      Object.values(timers.current).forEach(clearTimeout);
    },
    []
  );

  if (!toasts.length) return null;

  const position = settings?.notificationPosition || 'top-right';
  const posClass = POSITION_CLASSES[position] || POSITION_CLASSES['top-right'];
  const animClass = ANIM_CLASSES[position] || ANIM_CLASSES['top-right'];

  return (
    <div className={`no-print fixed z-[10000] flex flex-col gap-2 pointer-events-none ${posClass}`}>
      {toasts.map((t) => {
        const { Icon, iconClass, barClass } = ACTION_STYLES[t.action] || DEFAULT_STYLE;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto relative overflow-hidden flex items-center gap-2.5 bg-white border border-slate-100 shadow-xl rounded-lg pl-3.5 pr-3 py-3 text-sm font-medium text-slate-700 max-w-xs ${animClass}`}
          >
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${barClass}`} />
            <Icon size={18} className={`${iconClass} shrink-0`} />
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-slate-300 hover:text-slate-500 shrink-0" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}