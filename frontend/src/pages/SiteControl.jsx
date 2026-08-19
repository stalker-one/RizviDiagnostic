import React, { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout.jsx';
import Button from '../components/Button.jsx';
import PageLoader from '../components/PageLoader.jsx';
import { Power, ShieldAlert, AlertTriangle, CheckCircle2, Save, Upload, Trash2 } from 'lucide-react';
import api from '../api/axios';
import { useSettings } from '../context/SettingsContext.jsx';

const REASON_OPTIONS = [
  { key: 'payment_due', label: 'Payment Due', hint: 'Shown as a billing issue.' },
  { key: 'service_error_1', label: 'Service Error (503)', hint: 'Shown as a generic outage.' },
  { key: 'service_error_2', label: 'Service Error (500)', hint: 'Shown as an internal error.' },
];

export default function SiteControl() {
  const { setSettings: setGlobalSettings } = useSettings();
  const [status, setStatus] = useState(null);
  const [presets, setPresets] = useState({});
  const [selectedReason, setSelectedReason] = useState('service_error_1');
  const [branding, setBranding] = useState({ clinicName: '', logoUrl: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInputRef = useRef(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/site/status'), api.get('/site/presets'), api.get('/settings')])
      .then(([statusRes, presetsRes, settingsRes]) => {
        setStatus(statusRes.data);
        setPresets(presetsRes.data);
        setBranding({ clinicName: settingsRes.data?.clinicName || '', logoUrl: settingsRes.data?.logoUrl || '' });
        if (statusRes.data.reason) setSelectedReason(statusRes.data.reason);
        setGlobalSettings(settingsRes.data);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select a PNG, JPG, WEBP, or other image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be smaller than 2MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { setBranding((b) => ({ ...b, logoUrl: reader.result })); setError(''); };
    reader.readAsDataURL(file);
  };

  const saveBranding = async () => {
    const name = branding.clinicName.trim();
    if (!name) { setError('Application/clinic name is required.'); return; }
    setSavingBranding(true); setMessage(''); setError('');
    try {
      const res = await api.put('/settings', { clinicName: name, logoUrl: branding.logoUrl || '' });
      setBranding({ clinicName: res.data.clinicName || name, logoUrl: res.data.logoUrl || '' });
      setGlobalSettings(res.data);
      setMessage('Application name and logo updated. Changes are live across connected users.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save branding.');
    } finally { setSavingBranding(false); }
  };

  const removeLogo = () => { setBranding((b) => ({ ...b, logoUrl: '' })); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const deactivate = async () => {
    setBusy(true);
    try { const res = await api.put('/site/status', { disabled: true, reason: selectedReason }); setStatus(res.data); setConfirmOpen(false); }
    finally { setBusy(false); }
  };
  const reactivate = async () => {
    setBusy(true);
    try { const res = await api.put('/site/status', { disabled: false }); setStatus(res.data); }
    finally { setBusy(false); }
  };

  if (loading || !status) return <Layout title="Superadmin Control"><PageLoader message="Loading superadmin controls..." /></Layout>;

  return (
    <Layout title="Superadmin Control">
      <div className="max-w-3xl space-y-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-1"><h3 className="font-semibold text-slate-800">Application Branding</h3><span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700">Live</span></div>
          <p className="text-sm text-slate-500 mb-5">Change the application name and logo from the Superadmin account. Connected web and Android users receive the branding automatically through the realtime settings refresh.</p>
          <div className="space-y-4">
            <div><label className="block text-xs font-medium text-slate-500 mb-1">Application / Clinic Name</label><input value={branding.clinicName} onChange={(e) => setBranding((b) => ({ ...b, clinicName: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" maxLength={120} /></div>
            <div><label className="block text-xs font-medium text-slate-500 mb-1">Application Logo</label><div className="flex flex-wrap items-center gap-4"><div className="w-20 h-20 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">{branding.logoUrl ? <img src={branding.logoUrl} alt="Application logo" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-slate-400">No logo</span>}</div><div className="flex gap-2"><label className="inline-flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"><Upload size={16} /> Choose logo<input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} /></label>{branding.logoUrl && <button type="button" onClick={removeLogo} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50"><Trash2 size={16} /> Remove</button>}</div></div><p className="text-xs text-slate-400 mt-1">Maximum 2MB. PNG/JPG/WEBP recommended.</p></div>
            <Button icon={Save} onClick={saveBranding} disabled={savingBranding}>{savingBranding ? 'Saving…' : 'Save Branding'}</Button>
            {message && <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{message}</div>}
            {error && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
          </div>
        </div>

        <div className={`rounded-xl border p-5 flex items-start gap-3 ${status.disabled ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          {status.disabled ? <ShieldAlert size={22} className="text-red-500 mt-0.5 shrink-0" /> : <CheckCircle2 size={22} className="text-green-600 mt-0.5 shrink-0" />}
          <div><div className={`font-semibold ${status.disabled ? 'text-red-700' : 'text-green-700'}`}>{status.disabled ? 'Site is currently DEACTIVATED' : 'Site is live and running normally'}</div><p className="text-sm text-slate-600 mt-1">{status.disabled ? `Every admin and staff account is locked out and sees: "${status.message}"` : 'Admin and staff accounts can sign in and use the system as usual.'}</p></div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 sm:p-6">
          <h3 className="font-semibold text-slate-800 mb-1">Emergency Kill-Switch</h3>
          <p className="text-sm text-slate-500 mb-5">Instantly lock every admin and staff account out of the system. Only your superadmin account stays exempt.</p>
          <div className="space-y-2 mb-5">{REASON_OPTIONS.map((opt) => <label key={opt.key} className={`flex items-start gap-3 border rounded-lg px-3 py-2.5 cursor-pointer transition ${selectedReason === opt.key ? 'border-brand-500 bg-brand-50/50' : 'border-slate-200 hover:bg-slate-50'}`}><input type="radio" name="reason" className="mt-1" checked={selectedReason === opt.key} onChange={() => setSelectedReason(opt.key)} disabled={status.disabled} /><div><div className="text-sm font-medium text-slate-700">{opt.label}</div><div className="text-xs text-slate-400">{opt.hint}</div>{presets[opt.key] && <div className="text-xs text-slate-400 italic mt-1">"{presets[opt.key]}"</div>}</div></label>)}</div>
          {status.disabled ? <Button variant="success" icon={Power} onClick={reactivate} disabled={busy}>Reactivate Site</Button> : <Button variant="danger" icon={AlertTriangle} onClick={() => setConfirmOpen(true)} disabled={busy}>Deactivate Site</Button>}
        </div>

        {confirmOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5"><h4 className="font-semibold text-slate-800 mb-2">Deactivate the whole site?</h4><p className="text-sm text-slate-500 mb-4">Every admin and staff user will be locked out immediately. You can reactivate from this page.</p><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button><Button variant="danger" onClick={deactivate} disabled={busy}>Yes, deactivate</Button></div></div></div>}
      </div>
    </Layout>
  );
}
