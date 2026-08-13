import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

const ConfirmContext = createContext(null);

/**
 * Global replacement for window.confirm().
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm('Delete patient "John"? This cannot be undone.');
 *   if (!ok) return;
 *
 * Also supports an options form for a custom title / button labels:
 *   await confirm({ message: '...', title: 'Delete patient', confirmText: 'Delete', danger: true });
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { title, message, confirmText, cancelText, danger }
  const resolverRef = useRef(null);

  const confirm = useCallback((arg) => {
    const opts = typeof arg === 'string' ? { message: arg } : (arg || {});
    const {
      message = '',
      title = 'Please confirm',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      danger = false,
    } = opts;

    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({ message, title, confirmText, cancelText, danger });
    });
  }, []);

  const settle = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setState(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center bg-black/40 sm:p-4 no-print">
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl shadow-xl overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div
                  className={`shrink-0 rounded-full p-2 ${
                    state.danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  {state.danger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-800">{state.title}</h2>
                  <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{state.message}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => settle(false)}
                className="px-3.5 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-200"
              >
                {state.cancelText}
              </button>
              <button
                onClick={() => settle(true)}
                autoFocus
                className={`px-3.5 py-2 text-sm font-medium rounded-lg text-white ${
                  state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
