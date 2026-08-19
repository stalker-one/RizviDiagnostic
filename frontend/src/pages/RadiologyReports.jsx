import React, { useEffect, useMemo, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filter, Download, Printer, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import Layout from '../components/Layout.jsx';
import Button from '../components/Button.jsx';
import TableLoadingRow from '../components/TableLoadingRow.jsx';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';

const NativePrint = registerPlugin('Print');
const NativeExport = registerPlugin('Export');

const REPORT_HEADER = ['Invoice#', 'MR#', 'Patient', 'Referred By', 'Total', 'Paid', 'Discount', 'Due', 'Doctor', 'Department', 'Performed By (Dr.)', 'Shift', 'Booked By', 'Date'];
const reportRowValues = (r) => [r.invoiceNumber, r.mrNumber, r.patientName, r.referredBy, r.total, r.paid, r.discount, r.due, r.appointedDoctor, r.department, r.performedBy, r.shift, r.bookedBy, r.createdAt];
const summaryRowValues = (rows) => ['', '', '', 'TOTAL', rows.reduce((s, r) => s + r.total, 0), rows.reduce((s, r) => s + r.paid, 0), rows.reduce((s, r) => s + r.discount, 0), '', '', '', '', '', '', ''];

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  return btoa(binary);
}

function textToBase64(text) {
  return bytesToBase64(new TextEncoder().encode(text));
}

function buildReportHtml(rows) {
  const head = REPORT_HEADER.map((h) => `<th>${String(h).replace(/&/g, '&amp;')}</th>`).join('');
  const body = rows.map((r) => reportRowValues(r).map((v) => `<td>${String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')).map((cells) => `<tr>${cells}</tr>`).join('');
  const total = rows.length ? summaryRowValues(rows).map((v) => `<td>${String(v ?? '').replace(/&/g, '&amp;')}</td>`).join('') : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff;font-family:Arial,sans-serif;color:#111}h1{font-size:18px;margin:0 0 12px}table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #bbb;padding:5px;text-align:left}th{background:#eee;font-weight:700}tfoot td{font-weight:700;background:#f5f5f5}@page{size:A4 landscape;margin:8mm}</style></head><body><h1>Radiology Reports</h1><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${total ? `<tfoot><tr>${total}</tr></tfoot>` : ''}</table></body></html>`;
}

export default function RadiologyReports() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [limits, setLimits] = useState(null);
  const [range, setRange] = useState('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [shift, setShift] = useState('');
  const [doctor, setDoctor] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');

  useEffect(() => { api.get('/doctors').then((res) => setDoctors(res.data)).catch(() => {}); }, []);

  const load = (opts = {}) => {
    const r = opts.range ?? range, f = opts.from ?? from, t = opts.to ?? to, s = opts.shift ?? shift, d = opts.doctor ?? doctor;
    setLoading(true);
    api.get('/reports/radiology-reports', { params: { range: f || t ? undefined : r, from: f || undefined, to: t || undefined, shift: s || undefined, doctor: d || undefined } })
      .then((res) => { setRows(res.data.rows); setLimits(res.data.limits); if (res.data.range && res.data.range !== r) setRange(res.data.range); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectRange = (key) => { setRange(key); setFrom(''); setTo(''); load({ range: key, from: '', to: '' }); };
  const applyDateFilter = () => load({ from, to });
  const selectShift = (key) => { const next = shift === key ? '' : key; setShift(next); load({ shift: next }); };
  const selectDoctor = (name) => { setDoctor(name); load({ doctor: name }); };
  const totalRevenue = rows.reduce((s, r) => s + r.paid, 0);

  const exportCsv = async () => {
    if (exporting) return;
    setExporting('csv');
    try {
      const lines = rows.map((r) => reportRowValues(r).map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
      const csv = [REPORT_HEADER.join(','), ...lines, ...(rows.length ? [summaryRowValues(rows).map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')] : [])].join('\r\n');
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        await NativeExport.save({ name: 'radiology-reports.csv', mime: 'text/csv', data: textToBase64('\uFEFF' + csv) });
      } else {
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a'); a.href = url; a.download = 'radiology-reports.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) { console.error('[reports] CSV export failed', e); alert(e?.message || 'CSV export failed.'); }
    finally { setExporting(''); }
  };

  const exportXlsx = async () => {
    if (exporting) return;
    setExporting('xlsx');
    try {
      const data = [REPORT_HEADER, ...rows.map(reportRowValues), ...(rows.length ? [summaryRowValues(rows)] : [])];
      const sheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Radiology Reports');
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
        await NativeExport.save({ name: 'radiology-reports.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data: base64 });
      } else {
        XLSX.writeFile(workbook, 'radiology-reports.xlsx');
      }
    } catch (e) { console.error('[reports] XLSX export failed', e); alert(e?.message || 'Excel export failed.'); }
    finally { setExporting(''); }
  };

  const printReport = async () => {
    try {
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') await NativePrint.print({ html: buildReportHtml(rows), name: 'Rizvi Diagnostic Reports' });
      else window.print();
    } catch (e) { console.error('[reports] Print failed', e); alert(e?.message || 'Printing failed. Please check the Android print service.'); }
  };

  const rangeOptions = isAdmin ? [{ key: 'today', label: 'Today' }, { key: 'yesterday', label: 'Yesterday' }, { key: 'last3', label: 'Last 3 Days' }, { key: 'all', label: 'All / Date Range' }] : [];
  const doctorOptions = useMemo(() => {
    const fromDoctors = doctors.map((d) => d.name);
    const fromRows = rows.flatMap((r) => (r.performedBy ? r.performedBy.split(', ') : []));
    return [...new Set([...fromDoctors, ...fromRows])].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [doctors, rows]);

  return (
    <Layout title="Radiology Reports">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {isAdmin ? rangeOptions.map((opt) => <button key={opt.key} onClick={() => selectRange(opt.key)} className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${range === opt.key && !from && !to ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{opt.label}</button>) : <span className="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium bg-brand-600 text-white">Today's Data Only</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-4"><span className="text-xs font-medium text-slate-500 mr-1">Shift:</span>{['Morning', 'Evening'].map((key) => <button key={key} onClick={() => selectShift(key)} className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${shift === key ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{key} Shift</button>)}</div>
      {isAdmin && <div className="flex flex-wrap items-end gap-3 mb-4 bg-white rounded-xl border border-slate-100 shadow-sm p-4"><div><label className="block text-xs font-medium text-slate-500 mb-1">From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div><div><label className="block text-xs font-medium text-slate-500 mb-1">To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div><Button onClick={applyDateFilter} icon={Filter}>Filter by Date</Button><div><label className="block text-xs font-medium text-slate-500 mb-1">Doctor (Performed By)</label><select value={doctor} onChange={(e) => selectDoctor(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm min-w-[180px]"><option value="">All Doctors</option>{doctorOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></div></div>}
      <div className="flex flex-wrap items-center gap-2 mb-4"><Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!!exporting} size="sm">{exporting === 'csv' ? 'Exporting…' : 'Export CSV'}</Button><Button variant="secondary" icon={FileSpreadsheet} onClick={exportXlsx} disabled={!!exporting} size="sm">{exporting === 'xlsx' ? 'Exporting…' : 'Export Excel (.xlsx)'}</Button><Button variant="secondary" icon={Printer} onClick={printReport} disabled={!!exporting} size="sm">Print</Button><div className="sm:ml-auto text-sm text-slate-500 w-full sm:w-auto mt-1 sm:mt-0">Total Revenue: <span className="font-bold text-green-700">Rs. {totalRevenue.toLocaleString()}</span><span className="text-slate-400"> ({rows.length} {rows.length === 1 ? 'entry' : 'entries'})</span></div></div>
      <div id="printable-area" className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto"><table className="w-full text-sm min-w-[1050px]"><thead className="bg-slate-50 text-slate-500 text-left"><tr>{REPORT_HEADER.map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{loading ? <TableLoadingRow colSpan={14} /> : rows.length === 0 ? <tr><td colSpan={14} className="p-6 text-center text-slate-400">There is no radiology report to show.</td></tr> : rows.map((r) => <tr key={r.invoiceNumber} className="border-t border-slate-50"><td className="p-3 font-mono text-xs">{r.invoiceNumber}</td><td className="p-3 font-mono text-xs">{r.mrNumber}</td><td className="p-3">{r.patientName}</td><td className="p-3">{r.referredBy || '-'}</td><td className="p-3">Rs. {r.total.toLocaleString()}</td><td className="p-3">Rs. {r.paid.toLocaleString()}</td><td className="p-3">Rs. {r.discount.toLocaleString()}</td><td className="p-3 text-red-600">Rs. {r.due.toLocaleString()}</td><td className="p-3">{r.appointedDoctor || '-'}</td><td className="p-3">{r.department}</td><td className="p-3">{r.performedBy || '-'}</td><td className="p-3">{r.shift || '-'}</td><td className="p-3">{r.bookedBy || '-'}</td><td className="p-3">{new Date(r.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>
    </Layout>
  );
}
