import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';

const POSITIONS = [
  ['top-left', 'Top left'], ['top-center', 'Top center'], ['top-right', 'Top right'],
  ['center-left', 'Center left'], ['center', 'Center'], ['center-right', 'Center right'],
  ['bottom-left', 'Bottom left'], ['bottom-center', 'Bottom center'], ['bottom-right', 'Bottom right'],
];
const STYLES = [['classic', 'Classic'], ['circle', 'Circle'], ['ribbon', 'Ribbon']];
const FIELDS = [
  ['stampFontSize', 'Font size (px)', 8, 200, 26, 1],
  ['stampRotation', 'Rotation (degrees)', -180, 180, -18, 1],
  ['stampOpacity', 'Opacity', 0.15, 1, 0.82, 0.05],
  ['stampScale', 'Scale', 0.25, 4, 1, 0.05],
  ['stampOffsetX', 'X offset (px)', -500, 500, 0, 1],
  ['stampOffsetY', 'Y offset (px)', -500, 500, 0, 1],
  ['stampBorderWidth', 'Border width (px)', 1, 20, 3, 1],
];

function findMount() {
  if (window.location.pathname !== '/settings') return null;
  const heading = Array.from(document.querySelectorAll('h3')).find((el) => /simple\s*\(a4\).*print.*settings/i.test(el.textContent || ''));
  if (!heading) return null;
  const container = heading.closest('.bg-white') || heading.parentElement;
  if (!container) return null;
  let node = container.querySelector('#simple-paid-stamp-settings-mount');
  if (!node) {
    node = document.createElement('div');
    node.id = 'simple-paid-stamp-settings-mount';
    container.appendChild(node);
  }
  return node;
}

export default function SimpleStampSettingsEnhancer() {
  const [mount, setMount] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const attach = () => { const node = findMount(); if (!cancelled && node) setMount(node); };
    const load = async () => {
      try {
        const res = await api.get('/settings', { params: { _: Date.now() }, headers: { 'Cache-Control': 'no-cache' } });
        if (!cancelled) setValues(res.data || {});
      } catch {}
    };
    attach(); load();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(attach, 300);
    return () => { cancelled = true; observer.disconnect(); window.clearInterval(timer); document.getElementById('simple-paid-stamp-settings-mount')?.remove(); };
  }, []);

  if (!mount || window.location.pathname !== '/settings') return null;
  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));
  const save = async () => {
    setSaving(true); setMessage('');
    try {
      const payload = { ...values };
      FIELDS.forEach(([key, , min, max, fallback]) => {
        const n = Number(values[key]);
        payload[key] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
      });
      payload.stampEnabled = values.stampEnabled === true;
      payload.stampText = typeof values.stampText === 'string' ? values.stampText : 'PAID';
      payload.stampStyle = values.stampStyle || 'classic';
      payload.stampPosition = values.stampPosition || 'center-right';
      payload.stampColor = values.stampColor || '#c0392b';
      payload.stampShowClinicName = values.stampShowClinicName !== false;
      payload.stampShowDateTime = values.stampShowDateTime !== false;
      const res = await api.put('/settings', payload);
      setValues(res.data || payload);
      setMessage('Simple / A4 Paid Stamp settings saved.');
      window.dispatchEvent(new CustomEvent('rdc:settings-updated'));
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to save Simple / A4 Paid Stamp settings.');
    } finally { setSaving(false); }
  };

  return createPortal(
    <div className="border-t border-slate-100 pt-4 mt-4 space-y-4">
      <div><h4 className="font-semibold text-slate-700">Paid Stamp — Simple / A4</h4><p className="text-xs text-slate-500 mt-1">These settings use the <code>stamp*</code> values only. Thermal Paid Stamp settings remain separate.</p></div>
      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={values.stampEnabled === true} onChange={(e) => set('stampEnabled', e.target.checked)} />Enable Paid stamp on fully-paid A4 invoices</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="block text-xs font-medium text-slate-500 mb-1">Stamp text</label><input value={values.stampText || 'PAID'} onChange={(e) => set('stampText', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
        <div><label className="block text-xs font-medium text-slate-500 mb-1">Design style</label><select value={values.stampStyle || 'classic'} onChange={(e) => set('stampStyle', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">{STYLES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className="block text-xs font-medium text-slate-500 mb-1">Position</label><select value={values.stampPosition || 'center-right'} onChange={(e) => set('stampPosition', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">{POSITIONS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className="block text-xs font-medium text-slate-500 mb-1">Stamp color</label><input type="color" value={values.stampColor || '#c0392b'} onChange={(e) => set('stampColor', e.target.value)} className="w-20 h-10 border border-slate-200 rounded-lg" /></div>
        {FIELDS.map(([key, label, min, max, fallback, step]) => <div key={key}><label className="block text-xs font-medium text-slate-500 mb-1">{label}</label><input type="number" min={min} max={max} step={step} value={values[key] ?? fallback} onChange={(e) => set(key, e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={values.stampShowClinicName !== false} onChange={(e) => set('stampShowClinicName', e.target.checked)} />Show clinic name inside the stamp</label>
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={values.stampShowDateTime !== false} onChange={(e) => set('stampShowDateTime', e.target.checked)} />Show real date/time inside the stamp</label>
      </div>
      {message && <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{message}</div>}
      <button type="button" disabled={saving} onClick={save} className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save Simple / A4 Stamp'}</button>
    </div>, mount
  );
}
