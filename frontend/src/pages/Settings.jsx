import React, { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout.jsx';
import Button from '../components/Button.jsx';
import { Save, Plus } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import PageLoader from '../components/PageLoader.jsx';
import api from '../api/axios';
import { useSettings } from '../context/SettingsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'numbering', label: 'Numbering (MR# / Invoice#)' },
  { key: 'departments', label: 'Departments' },
  { key: 'logo', label: 'Logo' },
  { key: 'thermal', label: 'Thermal Print (80mm)' },
  { key: 'simple', label: 'Simple Print (A4)' },
  { key: 'stamp', label: 'Paid Stamp' },
  { key: 'staff', label: 'Staff Access' },
  { key: 'discount', label: 'Discount Control' },
  // Superadmin-only — see the filter on the tab bar below and the
  // superadmin check enforced again on the backend (settings.routes.js).
  { key: 'notifications', label: 'Toast Notifications' },
];

const NOTIFICATION_POSITIONS = [
  { value: 'top-right', label: 'Top right' },
  { value: 'top-left', label: 'Top left' },
  { value: 'top-center', label: 'Top center' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-center', label: 'Bottom center' },
];

const DEFAULT_DEPARTMENTS = ['X-Ray', 'Ultrasound', 'CT Scan', 'MRI', 'Procedure', 'General'];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DEFAULT_MONTH_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const DEFAULT_INVOICE_MONTH_CODES = ['JA', 'FE', 'MR', 'AP', 'MY', 'JN', 'JL', 'AU', 'SE', 'OC', 'NO', 'DE'];

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

// Converts a 24h hour number (e.g. 14) to a value an <input type="time">
// can display (e.g. "14:00"), and back again when the person picks a time.
function hourToTime(hour) {
  const h = Number.isFinite(Number(hour)) ? Number(hour) : 0;
  return `${String(Math.min(23, Math.max(0, h))).padStart(2, '0')}:00`;
}

function timeToHour(timeStr, fallback) {
  if (!timeStr) return fallback;
  const h = Number(timeStr.split(':')[0]);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : fallback;
}

export default function Settings() {
  const { setSettings: setGlobalSettings } = useSettings();
  const { isSuperadmin } = useAuth();
  const [form, setForm] = useState(null);
  const [tab, setTab] = useState('general');
  const [newDepartment, setNewDepartment] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pushStatus, setPushStatus] = useState(null);
  const [pushStatusLoading, setPushStatusLoading] = useState(false);
  const [pushTestResult, setPushTestResult] = useState(null);
  const [pushTestLoading, setPushTestLoading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get('/settings').then((res) => setForm(res.data));
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const departments = form?.departments && form.departments.length > 0 ? form.departments : DEFAULT_DEPARTMENTS;

  const addDepartment = () => {
    const name = newDepartment.trim();
    if (!name) return;
    if (departments.some((d) => d.toLowerCase() === name.toLowerCase())) {
      setError(`"${name}" is already in the department list.`);
      return;
    }
    setError('');
    set({ departments: [...departments, name] });
    setNewDepartment('');
  };

  const renameDepartment = (idx, value) => {
    const next = [...departments];
    next[idx] = value;
    set({ departments: next });
  };

  const removeDepartment = (idx) => {
    if (departments.length <= 1) {
      setError('At least one department is required.');
      return;
    }
    set({ departments: departments.filter((_, i) => i !== idx) });
  };

  const handleLogoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Please choose a logo image under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set({ logoUrl: reader.result });
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    set({ logoUrl: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await api.put('/settings', form);
      setForm(res.data);
      setGlobalSettings(res.data);
      setMessage('Practice settings updated successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <Layout title="Practice Settings"><PageLoader message="Loading settings..." /></Layout>;

  return (
    <Layout title="Practice Settings">
      <form onSubmit={submit} className="max-w-3xl space-y-4">
        <div className="flex gap-2 flex-wrap">
          {TABS.filter((t) => (t.key !== 'notifications' && t.key !== 'discount') || isSuperadmin).map((t) => (
            <button
              type="button"
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t.key ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
          {tab === 'general' && (
            <>
              <h3 className="font-semibold text-slate-700 mb-1">Clinic Details</h3>
              <Field label="Clinic Name *">
                <input required value={form.clinicName || ''} onChange={(e) => set({ clinicName: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </Field>
              <Field label="Address *">
                <textarea required value={form.address || ''} onChange={(e) => set({ address: e.target.value })} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Phone 1">
                  <input value={form.phone1 || ''} onChange={(e) => set({ phone1: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </Field>
                <Field label="Phone 2">
                  <input value={form.phone2 || ''} onChange={(e) => set({ phone2: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </Field>
              </div>
              <Field label="Invoice Prefix">
                <input value={form.invoicePrefix || ''} onChange={(e) => set({ invoicePrefix: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </Field>
              <Field label="Default Invoice Print Format">
                <select value={form.printFormat || 'both'} onChange={(e) => set({ printFormat: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="both">Offer Both (Thermal &amp; Simple)</option>
                  <option value="thermal">Thermal (80mm) Only</option>
                  <option value="simple">Simple (A4) Only</option>
                </select>
              </Field>
              <Field label="Invoice Footer Note (default)">
                <input value={form.footerNote || ''} onChange={(e) => set({ footerNote: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={form.headerClockEnabled !== false} onChange={(e) => set({ headerClockEnabled: e.target.checked })} />
                Show a live real-time clock in the header
              </label>
            </>
          )}

          {tab === 'numbering' && (
            <>
              <h3 className="font-semibold text-slate-700 mb-1">MR# (Medical Record Number) Numbering</h3>
              <p className="text-sm text-slate-500">
                Every new patient gets an MR# built from a letter for the current month plus a serial number.
                The serial automatically restarts from 1 at the beginning of each calendar month.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Digits in serial" hint="E.g. 4 digits -&gt; 0001, 0002...">
                  <input type="number" min={2} max={8} value={form.mrDigits || 4} onChange={(e) => set({ mrDigits: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </Field>
                <Field label="Include year in MR#">
                  <select value={form.mrIncludeYear === false ? 'no' : 'yes'} onChange={(e) => set({ mrIncludeYear: e.target.value !== 'no' })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="yes">Yes (e.g. A-26-0001)</option>
                    <option value="no">No (e.g. A-0001)</option>
                  </select>
                </Field>
              </div>
              <Field label="Month letters" hint="The letter used as the MR# prefix for each month. Change any of these to match your clinic's own convention.">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {MONTH_NAMES.map((monthName, idx) => {
                    const letters = form.mrMonthLetters || DEFAULT_MONTH_LETTERS;
                    return (
                      <div key={monthName} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-16 shrink-0">{monthName.slice(0, 3)}</span>
                        <input
                          maxLength={2}
                          value={letters[idx] ?? ''}
                          onChange={(e) => {
                            const next = [...(form.mrMonthLetters || DEFAULT_MONTH_LETTERS)];
                            next[idx] = e.target.value.toUpperCase().slice(0, 2);
                            set({ mrMonthLetters: next });
                          }}
                          className="w-12 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center uppercase"
                        />
                      </div>
                    );
                  })}
                </div>
              </Field>

              <h3 className="font-semibold text-slate-700 mb-1 pt-4 border-t border-slate-100">Invoice # Numbering</h3>
              <p className="text-sm text-slate-500">
                Invoice numbers are built as Prefix-MonthCode-Serial (e.g. RDC-JA-26-0001 for January) and the
                serial also restarts from 1 at the beginning of each calendar month.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Digits in serial">
                  <input type="number" min={2} max={8} value={form.invoiceDigits || 4} onChange={(e) => set({ invoiceDigits: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </Field>
                <Field label="Include year in Invoice#">
                  <select value={form.invoiceIncludeYear === false ? 'no' : 'yes'} onChange={(e) => set({ invoiceIncludeYear: e.target.value !== 'no' })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="yes">Yes (e.g. RDC-JA-26-0001)</option>
                    <option value="no">No (e.g. RDC-JA-0001)</option>
                  </select>
                </Field>
              </div>
              <Field label="Month codes" hint="The 2-letter code used in the Invoice# for each month. Change any of these to match your clinic's own convention.">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {MONTH_NAMES.map((monthName, idx) => {
                    const codes = form.invoiceMonthCodes || DEFAULT_INVOICE_MONTH_CODES;
                    return (
                      <div key={monthName} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-16 shrink-0">{monthName.slice(0, 3)}</span>
                        <input
                          maxLength={2}
                          value={codes[idx] ?? ''}
                          onChange={(e) => {
                            const next = [...(form.invoiceMonthCodes || DEFAULT_INVOICE_MONTH_CODES)];
                            next[idx] = e.target.value.toUpperCase().slice(0, 2);
                            set({ invoiceMonthCodes: next });
                          }}
                          className="w-12 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center uppercase"
                        />
                      </div>
                    );
                  })}
                </div>
              </Field>
            </>
          )}

          {tab === 'departments' && (
            <>
              <h3 className="font-semibold text-slate-700 mb-1">Departments</h3>
              <p className="text-sm text-slate-500">
                Manage the department list used across the app — the Doctors, Patients, and Radiology
                Procedure List dropdowns all pull from this same list, so add, rename, or remove a
                department here and it updates everywhere at once.
              </p>

              <div className="space-y-2">
                {departments.map((dep, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      value={dep}
                      onChange={(e) => renameDepartment(idx, e.target.value)}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeDepartment(idx)}
                      className="text-red-500 hover:underline text-sm shrink-0 px-2"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
                <input
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDepartment(); } }}
                  placeholder="New department name (e.g. ECG)"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
                <Button type="button" onClick={addDepartment} icon={Plus}>Add Department</Button>
              </div>
            </>
          )}

          {tab === 'logo' && (
            <>
              <h3 className="font-semibold text-slate-700 mb-1">Clinic Logo</h3>
              <p className="text-sm text-slate-500">
                Upload once here — it will automatically appear in the sidebar, on the login screen, and on both invoice
                print formats. Use the width/height controls below to fit it to your paper.
              </p>

              <div className="flex items-center gap-4 bg-slate-50 rounded-lg p-4">
                <Logo settings={form} width={form.logoWidth} height={form.logoHeight} />
                <div className="flex-1 space-y-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoFile} className="text-sm" />
                  {form.logoUrl && (
                    <button type="button" onClick={removeLogo} className="text-xs text-red-500 hover:underline block">
                      Remove logo
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="On-site / Simple Print — Width (px)">
                  <input type="number" min={20} max={300} value={form.logoWidth || 90} onChange={(e) => set({ logoWidth: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </Field>
                <Field label="On-site / Simple Print — Height (px)">
                  <input type="number" min={20} max={300} value={form.logoHeight || 90} onChange={(e) => set({ logoHeight: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </Field>
                <Field label="Thermal Receipt — Width (px)" hint="Thermal paper is narrow (80mm), so this is usually smaller.">
                  <input type="number" min={20} max={200} value={form.thermalLogoWidth || 60} onChange={(e) => set({ thermalLogoWidth: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </Field>
                <Field label="Thermal Receipt — Height (px)">
                  <input type="number" min={20} max={200} value={form.thermalLogoHeight || 60} onChange={(e) => set({ thermalLogoHeight: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </Field>
              </div>
            </>
          )}

          {tab === 'thermal' && (
            <>
              <h3 className="font-semibold text-slate-700 mb-1">Thermal (80mm) Print Settings</h3>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={!!form.thermalShowLogo} onChange={(e) => set({ thermalShowLogo: e.target.checked })} />
                Show logo on thermal receipt
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={!!form.thermalShowReferredBy} onChange={(e) => set({ thermalShowReferredBy: e.target.checked })} />
                Show "Referred By" on thermal receipt
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Paper Width (mm)">
                  <select value={form.thermalPaperWidth || 80} onChange={(e) => set({ thermalPaperWidth: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value={58}>58mm</option>
                    <option value={80}>80mm</option>
                  </select>
                </Field>
                <Field label="Font Size (px)">
                  <input type="number" min={9} max={16} value={form.thermalFontSize || 11} onChange={(e) => set({ thermalFontSize: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </Field>
              </div>
              <Field label="Thermal Footer Note">
                <input value={form.thermalFooterNote || ''} onChange={(e) => set({ thermalFooterNote: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </Field>
            </>
          )}

          {tab === 'simple' && (
            <>
              <h3 className="font-semibold text-slate-700 mb-1">Simple (A4) Print Settings</h3>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={!!form.simpleShowLogo} onChange={(e) => set({ simpleShowLogo: e.target.checked })} />
                Show logo on simple invoice
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={!!form.simpleShowReferredBy} onChange={(e) => set({ simpleShowReferredBy: e.target.checked })} />
                Show "Referred By" on simple invoice
              </label>
              <Field label="Accent Color">
                <input type="color" value={form.simpleAccentColor || '#0a4a93'} onChange={(e) => set({ simpleAccentColor: e.target.value })} className="w-20 h-10 border border-slate-200 rounded-lg" />
              </Field>
              <Field label="Template Style" hint="Choose the overall look of the printed A4 invoice.">
                <select
                  value={form.simpleTemplate || 'classic'}
                  onChange={(e) => set({ simpleTemplate: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="classic">Classic (bordered header, boxed table)</option>
                  <option value="compact">Compact (denser, smaller footprint)</option>
                  <option value="modern">Modern (bold color band header)</option>
                </select>
              </Field>
              <Field label="Simple Invoice Footer Note">
                <input value={form.simpleFooterNote || ''} onChange={(e) => set({ simpleFooterNote: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </Field>
            </>
          )}

          {tab === 'stamp' && (
            <>
              <h3 className="font-semibold text-slate-700 mb-1">Paid Stamp</h3>
              <p className="text-sm text-slate-500">
                A stamp overlay shown on fully-paid invoices (both Thermal &amp; Simple prints), with your clinic
                name and the real date/time it was printed — like a genuine cashier's stamp.
              </p>

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={!!form.stampEnabled} onChange={(e) => set({ stampEnabled: e.target.checked })} />
                Show the Paid stamp on fully-paid invoices
              </label>

              <Field label="Stamp text">
                <input value={form.stampText || 'PAID'} onChange={(e) => set({ stampText: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Design style">
                  <select value={form.stampStyle || 'classic'} onChange={(e) => set({ stampStyle: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="classic">Classic (rectangular border)</option>
                    <option value="circle">Circle badge</option>
                    <option value="ribbon">Ribbon banner</option>
                  </select>
                </Field>
                <Field label="Position on the printout">
                  <select value={form.stampPosition || 'center-right'} onChange={(e) => set({ stampPosition: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="top-left">Top left</option>
                    <option value="top-right">Top right</option>
                    <option value="center">Center</option>
                    <option value="center-right">Center right</option>
                    <option value="bottom-left">Bottom left</option>
                    <option value="bottom-right">Bottom right</option>
                  </select>
                </Field>
                <Field label="Stamp color">
                  <input type="color" value={form.stampColor || '#c0392b'} onChange={(e) => set({ stampColor: e.target.value })} className="w-20 h-10 border border-slate-200 rounded-lg" />
                </Field>
                <Field label="Rotation (degrees)">
                  <input type="number" min={-45} max={45} value={form.stampRotation ?? -18} onChange={(e) => set({ stampRotation: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </Field>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={form.stampShowClinicName !== false} onChange={(e) => set({ stampShowClinicName: e.target.checked })} />
                Show clinic name inside the stamp
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={form.stampShowDateTime !== false} onChange={(e) => set({ stampShowDateTime: e.target.checked })} />
                Show real date/time inside the stamp
              </label>
            </>
          )}

          {tab === 'staff' && (
            <>
              <h3 className="font-semibold text-slate-700 mb-1">Staff Data Visibility</h3>
              <p className="text-sm text-slate-500">
                Staff (front-desk) accounts always see only today's data in Radiology Reports, Invoices, and
                Patients — filtering by date/yesterday/last-3-days/all is reserved for admin and superadmin
                accounts, who always see everything. The setting below only controls how many days of history
                feed the staff Dashboard's revenue summary card.
              </p>

              <Field label="Staff Dashboard revenue summary — last (days)" hint="Set to 1 for 'today only'. E.g. 7 lets the staff Dashboard summary include the last week.">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={form.staffReportRangeDays ?? 1}
                  onChange={(e) => set({ staffReportRangeDays: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </Field>

              <h3 className="font-semibold text-slate-700 mb-1 pt-4 border-t border-slate-100">Staff Entry Limit</h3>
              <p className="text-sm text-slate-500">
                Beyond being locked to today's date, you can further limit how many of today's entries
                staff accounts actually see across <strong>Patients</strong>, <strong>Invoices</strong>, and the{' '}
                <strong>Dashboard</strong> cards. This never affects admin/superadmin accounts, and it never
                blocks a patient/invoice search — front desk can always find an existing record.
              </p>

              <Field label="Limit mode">
                <select
                  value={form.staffEntryLimitMode || 'all'}
                  onChange={(e) => set({ staffEntryLimitMode: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">Show all of today's data (no extra limit)</option>
                  <option value="count">Show only the most recent N entries</option>
                  <option value="percent">Show only the most recent X% of today's entries</option>
                </select>
              </Field>

              {form.staffEntryLimitMode === 'count' && (
                <Field label="Number of entries" hint="Applies to Patients, Invoices, and the Dashboard's revenue/invoice cards.">
                  <div className="flex flex-wrap gap-2">
                    {[5, 10, 20, 30, 50, 100].map((n) => (
                      <button
                        type="button"
                        key={n}
                        onClick={() => set({ staffEntryLimitCount: n })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                          Number(form.staffEntryLimitCount ?? 20) === n
                            ? 'bg-brand-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Last {n}
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              {form.staffEntryLimitMode === 'percent' && (
                <Field label="Percentage of today's entries" hint="E.g. 30% shows staff only the most recent 30% of today's patients/invoices.">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={form.staffEntryLimitPercent ?? 30}
                      onChange={(e) => set({ staffEntryLimitPercent: Number(e.target.value) })}
                      className="w-full"
                    />
                    <span className="text-sm font-semibold text-brand-700 w-14 text-right">
                      {form.staffEntryLimitPercent ?? 30}%
                    </span>
                  </div>
                </Field>
              )}

              <h3 className="font-semibold text-slate-700 mb-1 pt-4 border-t border-slate-100">Radiology Report Shifts</h3>
              <p className="text-sm text-slate-500">
                Radiology Reports can be filtered by Morning or Evening shift. Set the times below —
                invoices created from Morning start up to (but not including) Evening start count as
                Morning; everything else counts as Evening.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Morning shift starts at">
                  <input
                    type="time"
                    value={hourToTime(form.morningStartHour ?? 8)}
                    onChange={(e) => set({ morningStartHour: timeToHour(e.target.value, 8) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Evening shift starts at">
                  <input
                    type="time"
                    value={hourToTime(form.eveningStartHour ?? form.shiftSplitHour ?? 14)}
                    onChange={(e) => set({ eveningStartHour: timeToHour(e.target.value, 14) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </Field>
              </div>
            </>
          )}

          {tab === 'discount' && isSuperadmin && (
            <>
              <h3 className="font-semibold text-slate-700 mb-1">Discount Control</h3>
              <p className="text-sm text-slate-500">
                Control whether staff and admin users may apply discounts while creating or editing invoices.
                Disabling this option is enforced by the server, so users cannot bypass it from another device.
                Existing invoices keep their recorded discounts unchanged.
              </p>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.discountEnabled !== false}
                  onChange={(e) => set({ discountEnabled: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span>
                  <strong className="block">Allow discounts on invoices</strong>
                  <span className="text-xs text-slate-500">Uncheck to remove the discount field for everyone except Superadmin.</span>
                </span>
              </label>
            </>
          )}

          {tab === 'notifications' && isSuperadmin && (
            <>
              <h3 className="font-semibold text-slate-700 mb-1">Toast Notifications</h3>
              <p className="text-sm text-slate-500">
                Whenever new data is added anywhere in the system — patients, invoices, doctors,
                procedures, referrals, or users — a small toast pops up on screen to confirm it.
                This is a superadmin-only setting.
              </p>

              <label className="flex items-center gap-3 text-sm text-slate-600">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.notificationsEnabled !== false}
                  onClick={() => set({ notificationsEnabled: !(form.notificationsEnabled !== false) })}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    form.notificationsEnabled !== false ? 'bg-brand-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      form.notificationsEnabled !== false ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                Enable toast notifications for new data
              </label>

              <Field label="Notification Position" hint="Where the toast popups appear on everyone's screen.">
                <select
                  value={form.notificationPosition || 'top-right'}
                  onChange={(e) => set({ notificationPosition: e.target.value })}
                  disabled={form.notificationsEnabled === false}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                >
                  {NOTIFICATION_POSITIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </Field>

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('rdc:data-added', { detail: { message: 'Preview: New record added successfully' } })
                  )
                }
              >
                Send test toast
              </Button>

              <div className="mt-6 pt-5 border-t border-slate-200">
                <h3 className="font-semibold text-slate-700 mb-1">Push Notification Diagnostics (Android)</h3>
                <p className="text-sm text-slate-500 mb-3">
                  Checks whether Android push notifications (update, patient created, invoice created) are
                  actually reaching this account's device. Use this instead of guessing — it tells you exactly
                  which step is broken.
                </p>

                <div className="flex flex-wrap gap-2 mb-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pushStatusLoading}
                    onClick={async () => {
                      setPushStatusLoading(true);
                      setPushStatus(null);
                      try {
                        const res = await api.get('/push/status');
                        setPushStatus({ ok: true, data: res.data });
                      } catch (e) {
                        setPushStatus({ ok: false, error: e?.response?.data?.message || e.message });
                      } finally {
                        setPushStatusLoading(false);
                      }
                    }}
                  >
                    {pushStatusLoading ? 'Checking…' : 'Check status'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pushTestLoading}
                    onClick={async () => {
                      setPushTestLoading(true);
                      setPushTestResult(null);
                      try {
                        const res = await api.post('/push/test-send');
                        setPushTestResult({ ok: true, data: res.data });
                      } catch (e) {
                        setPushTestResult({ ok: false, error: e?.response?.data?.message || e.message });
                      } finally {
                        setPushTestLoading(false);
                      }
                    }}
                  >
                    {pushTestLoading ? 'Sending…' : 'Send test push to my device'}
                  </Button>
                </div>

                {pushStatus && (
                  <div className={`text-sm rounded-lg px-3 py-2 mb-2 ${pushStatus.ok ? 'bg-slate-50 text-slate-700' : 'bg-red-50 text-red-600'}`}>
                    {pushStatus.ok ? (
                      <>
                        <div>Firebase configured on server: <strong>{pushStatus.data.firebaseConfigured ? 'Yes' : 'No'}</strong></div>
                        <div>Total registered devices (all accounts): <strong>{pushStatus.data.totalRegisteredDevices}</strong></div>
                        <div>Your own registered device(s): <strong>{pushStatus.data.myRegisteredDevices.length}</strong></div>
                        {pushStatus.data.myRegisteredDevices.length === 0 && (
                          <div className="mt-1 text-amber-600">
                            No device registered under your account — open the Android app and log in with this
                            same account, wait a few seconds, then check again.
                          </div>
                        )}
                      </>
                    ) : (
                      <div>Error: {pushStatus.error}</div>
                    )}
                  </div>
                )}

                {pushTestResult && (
                  <div className={`text-sm rounded-lg px-3 py-2 ${pushTestResult.ok ? 'bg-slate-50 text-slate-700' : 'bg-red-50 text-red-600'}`}>
                    {pushTestResult.ok ? (
                      <>
                        <div>Attempted: <strong>{pushTestResult.data.attempted}</strong>, Succeeded: <strong>{pushTestResult.data.succeeded}</strong>, Failed: <strong>{pushTestResult.data.failed}</strong></div>
                        {pushTestResult.data.errors?.length > 0 && (
                          <div className="mt-1">
                            {pushTestResult.data.errors.map((e, i) => <div key={i}>{e}</div>)}
                          </div>
                        )}
                        {pushTestResult.data.succeeded > 0 && (
                          <div className="mt-1 text-green-700">
                            Firebase accepted the send. If nothing appeared on your phone, the issue is on-device
                            (permission, battery optimization, or OEM restrictions) rather than the server.
                          </div>
                        )}
                      </>
                    ) : (
                      <div>Error: {pushTestResult.error}</div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {message && <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{message}</div>}
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

          <Button type="submit" disabled={saving} size="lg" icon={Save}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Layout>
  );
}
