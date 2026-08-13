import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import Button from '../components/Button.jsx';
import PageLoader from '../components/PageLoader.jsx';
import { Power, ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '../api/axios';

const REASON_OPTIONS = [
  {
    key: 'payment_due',
    label: 'Payment Due',
    hint: 'Shown as a billing issue — "clinic subscription has a remaining due balance."',
  },
  {
    key: 'service_error_1',
    label: 'Service Error (503)',
    hint: 'Shown as a generic outage — "application service is temporarily unavailable."',
  },
  {
    key: 'service_error_2',
    label: 'Service Error (500)',
    hint: 'Shown as an internal error — "an unexpected internal error occurred."',
  },
];

export default function SiteControl() {
  const [status, setStatus] = useState(null); // { disabled, reason, message }
  const [presets, setPresets] = useState({});
  const [selectedReason, setSelectedReason] = useState('service_error_1');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/site/status'), api.get('/site/presets')])
      .then(([statusRes, presetsRes]) => {
        setStatus(statusRes.data);
        setPresets(presetsRes.data);
        if (statusRes.data.reason) setSelectedReason(statusRes.data.reason);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const deactivate = async () => {
    setBusy(true);
    try {
      const res = await api.put('/site/status', { disabled: true, reason: selectedReason });
      setStatus(res.data);
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const reactivate = async () => {
    setBusy(true);
    try {
      const res = await api.put('/site/status', { disabled: false });
      setStatus(res.data);
    } finally {
      setBusy(false);
    }
  };

  if (loading || !status) {
    return (
      <Layout title="Site Control">
        <PageLoader message="Loading site status..." />
      </Layout>
    );
  }

  return (
    <Layout title="Site Control">
      <div className="max-w-2xl">
        <div className={`rounded-xl border p-5 mb-6 flex items-start gap-3 ${status.disabled ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          {status.disabled ? (
            <ShieldAlert size={22} className="text-red-500 mt-0.5 shrink-0" />
          ) : (
            <CheckCircle2 size={22} className="text-green-600 mt-0.5 shrink-0" />
          )}
          <div>
            <div className={`font-semibold ${status.disabled ? 'text-red-700' : 'text-green-700'}`}>
              {status.disabled ? 'Site is currently DEACTIVATED' : 'Site is live and running normally'}
            </div>
            <p className="text-sm text-slate-600 mt-1">
              {status.disabled
                ? `Every admin and staff account is locked out and sees: "${status.message}"`
                : 'Admin and staff accounts can sign in and use the system as usual.'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 sm:p-6">
          <h3 className="font-semibold text-slate-800 mb-1">Emergency Kill-Switch</h3>
          <p className="text-sm text-slate-500 mb-5">
            Instantly lock every admin and staff account out of the system — login and every screen —
            no matter what they're doing. Only your superadmin account stays exempt. They'll see a
            plain, non-alarming message instead of any real reason.
          </p>

          <div className="space-y-2 mb-5">
            {REASON_OPTIONS.map((opt) => (
              <label
                key={opt.key}
                className={`flex items-start gap-3 border rounded-lg px-3 py-2.5 cursor-pointer transition ${
                  selectedReason === opt.key ? 'border-brand-500 bg-brand-50/50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  className="mt-1"
                  checked={selectedReason === opt.key}
                  onChange={() => setSelectedReason(opt.key)}
                  disabled={status.disabled}
                />
                <div>
                  <div className="text-sm font-medium text-slate-700">{opt.label}</div>
                  <div className="text-xs text-slate-400">{opt.hint}</div>
                  {presets[opt.key] && (
                    <div className="text-xs text-slate-400 italic mt-1">"{presets[opt.key]}"</div>
                  )}
                </div>
              </label>
            ))}
          </div>

          {status.disabled ? (
            <Button variant="success" icon={Power} onClick={reactivate} disabled={busy}>
              Reactivate Site
            </Button>
          ) : (
            <Button variant="danger" icon={AlertTriangle} onClick={() => setConfirmOpen(true)} disabled={busy}>
              Deactivate Site
            </Button>
          )}
        </div>

        {confirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
              <h4 className="font-semibold text-slate-800 mb-2">Deactivate the whole site?</h4>
              <p className="text-sm text-slate-500 mb-4">
                Every admin and staff user will be locked out immediately, including anyone currently
                logged in. You can reactivate at any time from this same page.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                <Button variant="danger" onClick={deactivate} disabled={busy}>Yes, deactivate</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
