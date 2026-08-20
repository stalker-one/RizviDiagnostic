import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';

const FIELDS = [
  ['thermalMarginTop', 'Top margin (px)', 0, 20, 0],
  ['thermalMarginRight', 'Right margin (px)', 0, 20, 0],
  ['thermalMarginBottom', 'Bottom margin (px)', 0, 30, 0],
  ['thermalMarginLeft', 'Left margin (px)', 0, 20, 0],
  ['thermalPaddingTop', 'Top padding (px)', 0, 30, 6],
  ['thermalPaddingRight', 'Right padding (px)', 0, 30, 8],
  ['thermalPaddingBottom', 'Bottom padding (px)', 0, 30, 6],
  ['thermalPaddingLeft', 'Left padding (px)', 0, 30, 8],
  ['thermalSectionSpacing', 'Section spacing (px)', 0, 30, 5],
  ['thermalTableSpacing', 'Table spacing (px)', 0, 30, 8],
  ['thermalCellPadding', 'Table cell padding (px)', 0, 15, 3],
  ['thermalLineHeight', 'Line height', 1, 2.5, 1.5],
];

export default function ThermalSettingsEnhancer() {
  const [mount, setMount] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (window.location.pathname !== '/settings') return undefined;

    let cancelled = false;
    let observer;
    let timer;

    const attach = () => {
      if (cancelled) return;
      const labels = Array.from(document.querySelectorAll('label'));
      const footerLabel = labels.find((label) => label.textContent?.trim() === 'Thermal Footer Note');
      if (!footerLabel) return;
      const field = footerLabel.parentElement;
      if (!field) return;

      let node = document.getElementById('thermal-layout-settings-mount');
      if (!node) {
        node = document.createElement('div');
        node.id = 'thermal-layout-settings-mount';
        field.insertAdjacentElement('afterend', node);
      }
      setMount(node);
    };

    const load = async () => {
      try {
        const res = await api.get('/settings', { params: { _: Date.now() }, headers: { 'Cache-Control': 'no-cache' } });
        if (!cancelled) setValues(res.data || {});
      } catch {}
    };

    attach();
    load();
    observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    timer = window.setInterval(attach, 500);

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.clearInterval(timer);
      document.getElementById('thermal-layout-settings-mount')?.remove();
    };
  }, []);

  if (!mount || window.location.pathname !== '/settings') return null;

  const setValue = (key, value) => setValues((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const payload = {};
      for (const [key, , min, max, fallback] of FIELDS) {
        const n = Number(values[key]);
        payload[key] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
      }
      const res = await api.put('/settings', payload);
      setValues(res.data || {});
      setMessage('Thermal layout settings saved successfully.');
      window.setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to save thermal settings.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mt-4 space-y-4">
      <div>
        <h3 className="font-semibold text-slate-700">Thermal Layout Controls</h3>
        <p className="text-xs text-slate-500 mt-1">Fine-tune spacing and typography. These settings apply to the live site and both Android applications.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map(([key, label, min, max, fallback]) => (
          <div key={key}>
            <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
            <input
              type="number"
              min={min}
              max={max}
              step={key === 'thermalLineHeight' ? 0.1 : 1}
              value={values[key] ?? fallback}
              onChange={(e) => setValue(key, e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-60">
          {saving ? 'Saving...' : 'Save Thermal Layout'}
        </button>
        {message && <span className="text-sm text-slate-600">{message}</span>}
      </div>
    </div>,
    mount,
  );
}
