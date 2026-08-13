import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout.jsx';
import Button from '../components/Button.jsx';
import TableLoadingRow from '../components/TableLoadingRow.jsx';
import { Filter, Download, Printer, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';

const REPORT_HEADER = [
  'Invoice#', 'MR#', 'Patient', 'Referred By', 'Total', 'Paid', 'Discount', 'Due',
  'Doctor', 'Department', 'Performed By (Dr.)', 'Shift', 'Booked By', 'Date',
];

const reportRowValues = (r) => [
  r.invoiceNumber, r.mrNumber, r.patientName, r.referredBy, r.total, r.paid, r.discount, r.due,
  r.appointedDoctor, r.department, r.performedBy, r.shift, r.bookedBy, r.createdAt,
];

// Totals row appended to the end of both exports, aligned under the
// Total/Paid/Discount columns so it lines up with the data above it.
const summaryRowValues = (rows) => {
  const totalSum = rows.reduce((s, r) => s + r.total, 0);
  const paidSum = rows.reduce((s, r) => s + r.paid, 0);
  const discountSum = rows.reduce((s, r) => s + r.discount, 0);
  return ['', '', '', 'TOTAL', totalSum, paidSum, discountSum, '', '', '', '', '', '', ''];
};

export default function RadiologyReports() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [limits, setLimits] = useState(null); // null for admins (unrestricted); { lockedToToday: true } for staff
  const [range, setRange] = useState('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [shift, setShift] = useState(''); // '', 'Morning', 'Evening'
  const [doctor, setDoctor] = useState(''); // '' = all doctors
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/doctors').then((res) => setDoctors(res.data)).catch(() => {});
  }, []);

  const load = (opts = {}) => {
    const r = opts.range ?? range;
    const f = opts.from ?? from;
    const t = opts.to ?? to;
    const s = opts.shift ?? shift;
    const d = opts.doctor ?? doctor;
    setLoading(true);
    api
      .get('/reports/radiology-reports', {
        params: {
          range: f || t ? undefined : r, // explicit dates take priority over the range preset
          from: f || undefined,
          to: t || undefined,
          shift: s || undefined,
          doctor: d || undefined,
        },
      })
      .then((res) => {
        setRows(res.data.rows);
        setLimits(res.data.limits);
        if (res.data.range && res.data.range !== r) setRange(res.data.range); // backend may have clamped it
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectRange = (key) => {
    setRange(key);
    setFrom('');
    setTo('');
    load({ range: key, from: '', to: '' });
  };

  const applyDateFilter = () => {
    load({ from, to });
  };

  const selectShift = (key) => {
    const next = shift === key ? '' : key; // clicking the active shift again clears it
    setShift(next);
    load({ shift: next });
  };

  const selectDoctor = (name) => {
    setDoctor(name);
    load({ doctor: name });
  };

  const totalRevenue = rows.reduce((s, r) => s + r.paid, 0);

  const exportCsv = () => {
    const lines = rows.map((r) => reportRowValues(r).map((v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(','));
    const rowsOut = rows.length ? [...lines, summaryRowValues(rows).map((v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(',')] : lines;
    const csv = [REPORT_HEADER.join(','), ...rowsOut].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'radiology-reports.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportXlsx = () => {
    const data = [REPORT_HEADER, ...rows.map(reportRowValues), ...(rows.length ? [summaryRowValues(rows)] : [])];
    const sheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Radiology Reports');
    XLSX.writeFile(workbook, 'radiology-reports.xlsx');
  };

  // Staff are locked to today's data only, so they get no range toggle at
  // all (just the "Today" badge below). Admins get the full set of presets.
  const rangeOptions = isAdmin
    ? [
        { key: 'today', label: 'Today' },
        { key: 'yesterday', label: 'Yesterday' },
        { key: 'last3', label: 'Last 3 Days' },
        { key: 'all', label: 'All / Date Range' },
      ]
    : [];

  // Doctor options for the "export/filter by dr name" dropdown — every
  // doctor on file, plus anyone who has ever been typed into "Performed By"
  // on an invoice item but isn't in the Doctors list, so the filter always
  // matches what's actually in the reports.
  const doctorOptions = useMemo(() => {
    const fromDoctors = doctors.map((d) => d.name);
    const fromRows = rows.flatMap((r) => (r.performedBy ? r.performedBy.split(', ') : []));
    return [...new Set([...fromDoctors, ...fromRows])].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [doctors, rows]);

  return (
    <Layout title="Radiology Reports">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {isAdmin ? (
          rangeOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => selectRange(opt.key)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
                range === opt.key && !from && !to ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))
        ) : (
          <span className="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium bg-brand-600 text-white">
            Today's Data Only
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs font-medium text-slate-500 mr-1">Shift:</span>
        {['Morning', 'Evening'].map((key) => (
          <button
            key={key}
            onClick={() => selectShift(key)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
              shift === key ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {key} Shift
          </button>
        ))}
      </div>

      {isAdmin && (
        <div className="flex flex-wrap items-end gap-3 mb-4 bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <Button onClick={applyDateFilter} icon={Filter}>Filter by Date</Button>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Doctor (Performed By)</label>
            <select
              value={doctor}
              onChange={(e) => selectDoctor(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm min-w-[180px]"
            >
              <option value="">All Doctors</option>
              {doctorOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button variant="secondary" icon={Download} onClick={exportCsv} size="sm">Export CSV</Button>
        <Button variant="secondary" icon={FileSpreadsheet} onClick={exportXlsx} size="sm">Export Excel (.xlsx)</Button>
        <Button variant="secondary" icon={Printer} onClick={() => window.print()} size="sm">Print</Button>
        <div className="sm:ml-auto text-sm text-slate-500 w-full sm:w-auto mt-1 sm:mt-0">
          Total Revenue: <span className="font-bold text-green-700">Rs. {totalRevenue.toLocaleString()}</span>
          <span className="text-slate-400"> ({rows.length} {rows.length === 1 ? 'entry' : 'entries'})</span>
        </div>
      </div>

      <div id="printable-area" className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[1050px]">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="p-3">Invoice#</th>
              <th className="p-3">MR#</th>
              <th className="p-3">Patient Name</th>
              <th className="p-3">Referred By</th>
              <th className="p-3">Total</th>
              <th className="p-3">Paid</th>
              <th className="p-3">Discount</th>
              <th className="p-3">Due</th>
              <th className="p-3">Doctor</th>
              <th className="p-3">Department</th>
              <th className="p-3">Performed By (Dr.)</th>
              <th className="p-3">Shift</th>
              <th className="p-3">Booked By</th>
              <th className="p-3">Date/Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={14} />
            ) : rows.length === 0 ? (
              <tr><td colSpan={14} className="p-6 text-center text-slate-400">There is no radiology report to show.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.invoiceNumber} className="border-t border-slate-50">
                  <td className="p-3 font-mono text-xs">{r.invoiceNumber}</td>
                  <td className="p-3 font-mono text-xs">{r.mrNumber}</td>
                  <td className="p-3">{r.patientName}</td>
                  <td className="p-3">{r.referredBy || '-'}</td>
                  <td className="p-3">Rs. {r.total.toLocaleString()}</td>
                  <td className="p-3">Rs. {r.paid.toLocaleString()}</td>
                  <td className="p-3">Rs. {r.discount.toLocaleString()}</td>
                  <td className="p-3 text-red-600">Rs. {r.due.toLocaleString()}</td>
                  <td className="p-3">{r.appointedDoctor || '-'}</td>
                  <td className="p-3">{r.department}</td>
                  <td className="p-3">{r.performedBy || '-'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.shift === 'Morning' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>
                      {r.shift || '-'}
                    </span>
                  </td>
                  <td className="p-3">{r.bookedBy || '-'}</td>
                  <td className="p-3">{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
