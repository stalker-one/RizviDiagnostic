import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';

const FIELDS = [
  ['thermalFontSize', 'Font size (px)', 8, 32, 16, 1],
  ['thermalLineHeight', 'Line height', 1, 2.5, 1.5, 0.1],
  ['thermalMarginTop', 'Top margin (px)', 0, 30, 0, 1],
  ['thermalMarginRight', 'Right margin (px)', 0, 30, 0, 1],
  ['thermalMarginBottom', 'Bottom margin (px)', 0, 30, 0, 1],
  ['thermalMarginLeft', 'Left margin (px)', 0, 30, 0, 1],
  ['thermalPaddingTop', 'Top padding (px)', 0, 30, 6, 1],
  ['thermalPaddingRight', 'Right padding (px)', 0, 30, 8, 1],
  ['thermalPaddingBottom', 'Bottom padding (px)', 0, 30, 6, 1],
  ['thermalPaddingLeft', 'Left padding (px)', 0, 30, 8, 1],
  ['thermalSectionSpacing', 'Section spacing (px)', 0, 30, 5, 1],
  ['thermalTableSpacing', 'Table spacing (px)', 0, 30, 8, 1],
  ['thermalCellPadding', 'Table cell padding (px)', 0, 15, 3, 1],
];

function findMount() {
  if (window.location.pathname !== '/settings') return null;
  const heading = Array.from(document.querySelectorAll('h3')).find((el) => /thermal.*print.*settings/i.test(el.textContent || ''));
  if (!heading) return null;
  const container = heading.closest('.bg-white') || heading.parentElement;
  if (!container) return null;
  let node = container.querySelector('#thermal-layout-settings-mount');
  if (!node) {
    node = document.createElement('div');
    node.id = 'thermal-layout-settings-mount';
    container.appendChild(node);
  }
  return node;
}

export default function ThermalSettingsEnhancer() {
  const [mount, setMount] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    let observer;
    let timer;
    const attach = () => { const node = findMount(); if (!cancelled && node) setMount(node); };
    const load = async () => {
      try {
        const res = await api.get('/settings', { params: { _: Date.now() }, headers: { 'Cache-Control': 'no-cache' } });
        if (!cancelled) setValues(res.data || {});
      } catch {}
    };
    attach(); load();
    observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    timer = window.setInterval(attach, 300);
    return () => {
      cancelled = true;
      observer?.disconnect();
      window.clearInterval(timer);
      document.getElementById('thermal-layout-settings-mount')?.remove();
    };
  }, []);

  if (!mount || window.location.pathname !== '/settings') return null;

  const save = async () => {
    setSaving(true); setMessage('');
    try {
      const payload = {};
      for (const [key, , min, max, fallback] of FIELDS) {
        const n = Number(values[key]);
        payload[key] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
      }
      const res = await api.put('/settings', payload);
      setValues(res.data || {});
      setMessage('Thermal layout settings saved successfully.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to save thermal settings.');
    } finally { setSaving(false); }
  };

  return createPortal(
    <div className="border-t border-slate-100 pt-4 mt-4 space-y-4">
      <div>
        <h4 className="font-semibold text-slate-700">Thermal Layout &amp; Typography</h4>
        <p className="text-xs text-slate-500 mt-1">Fine-tune the 80mm thermal receipt. These values are used by the live site and both Android applications.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map(([key, label, min, max, fallback, step]) => (
          <div key={key}>
            <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
            <input type="number" min={min} max={max} step={step} value={values[key] ?? fallback}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-60">
          {saving ? 'Saving...' : 'Save Thermal Layout Settings'}
        </button>
        {message && <span className="text-sm text-slate-600">{message}</span>}
      </div>
    </div>, mount
  );
}
