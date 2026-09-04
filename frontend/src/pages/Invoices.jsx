import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Button from '../components/Button.jsx';
import TableLoadingRow from '../components/TableLoadingRow.jsx';
import { Eye, Trash2, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import useRealtimeRefresh from '../hooks/useRealtimeRefresh.js';

const RANGE_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last3', label: 'Last 3 Days' },
  { key: 'all', label: 'All' },
];

export default function Invoices() {
  const { isAdmin, isSuperadmin } = useAuth();
  const confirm = useConfirm();
  const [invoices, setInvoices] = useState([]);
  const [range, setRange] = useState('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);

  const load = (opts = {}) => {
    const r = opts.range ?? range;
    const f = opts.from ?? from;
    const t = opts.to ?? to;
    const p = opts.page ?? page;
    if (!opts.realtime) setLoading(true);
    api
      .get('/invoices', {
        params: {
          range: f || t ? undefined : r,
          from: f || undefined,
          to: t || undefined,
          page: p,
          pageSize: 100,
        },
      })
      .then((res) => {
        setInvoices(res.data.rows);
        setSelectedInvoiceIds((current) => current.filter((id) => res.data.rows.some((invoice) => String(invoice.id) === String(id))));
        setPage(res.data.page);
        setPageInfo({ total: res.data.total, totalPages: res.data.totalPages });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useRealtimeRefresh(load, ['invoices']);

  const selectRange = (key) => {
    setRange(key);
    setFrom('');
    setTo('');
    setPage(1);
    load({ range: key, from: '', to: '', page: 1 });
  };

  const applyDateFilter = () => {
    setPage(1);
    load({ page: 1 });
  };

  const goToPage = (p) => {
    setPage(p);
    load({ page: p });
  };

  const remove = async (inv) => {
    const ok = await confirm({
      title: 'Delete invoice',
      message: `Delete invoice ${inv.invoiceNumber}?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await api.delete(`/invoices/${inv.id}`);
    setSelectedInvoiceIds((current) => current.filter((id) => String(id) !== String(inv.id)));
    load();
  };

  const toggleInvoiceSelection = (invoiceId) => {
    const id = String(invoiceId);
    setSelectedInvoiceIds((current) => current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]);
  };

  const toggleAllVisibleInvoices = () => {
    const visibleIds = invoices.map((invoice) => String(invoice.id));
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedInvoiceIds.includes(id));
    setSelectedInvoiceIds((current) => allSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  };

  const removeSelectedInvoices = async () => {
    if (!selectedInvoiceIds.length) return;
    const ok = await confirm({
      title: 'Delete selected invoices',
      message: `Delete ${selectedInvoiceIds.length} selected ${selectedInvoiceIds.length === 1 ? 'invoice' : 'invoices'}? This cannot be undone.`,
      confirmText: 'Delete Selected',
      danger: true,
    });
    if (!ok) return;
    await api.post('/invoices/bulk-delete', { ids: selectedInvoiceIds });
    setSelectedInvoiceIds([]);
    load();
  };

  return (
    <Layout title="Invoices">
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => selectRange(opt.key)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
                range === opt.key && !from && !to ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

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
        </div>
      )}

      {isSuperadmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={invoices.length > 0 && invoices.every((invoice) => selectedInvoiceIds.includes(String(invoice.id)))}
              onChange={toggleAllVisibleInvoices}
              aria-label="Select all visible invoices"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Select all visible invoices
          </label>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{selectedInvoiceIds.length} selected</span>
            <Button variant="danger" size="sm" icon={Trash2} onClick={removeSelectedInvoices} disabled={!selectedInvoiceIds.length}>Delete Selected</Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              {isSuperadmin && <th className="p-3 w-12" aria-label="Select invoices"></th>}
              <th className="p-3">Invoice#</th>
              <th className="p-3">Patient</th>
              <th className="p-3">Total</th>
              <th className="p-3">Discount</th>
              <th className="p-3">Paid</th>
              <th className="p-3">Due</th>
              <th className="p-3">Status</th>
              <th className="p-3">Booked By</th>
              <th className="p-3">Date</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={isSuperadmin ? 11 : 10} />
            ) : invoices.length === 0 ? (
              <tr><td colSpan={isSuperadmin ? 11 : 10} className="p-6 text-center text-slate-400">No invoices yet.</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-slate-50 hover:bg-slate-50">
                  {isSuperadmin && (
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedInvoiceIds.includes(String(inv.id))}
                        onChange={() => toggleInvoiceSelection(inv.id)}
                        aria-label={`Select invoice ${inv.invoiceNumber}`}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                    </td>
                  )}
                  <td className="p-3 font-mono text-xs">{inv.invoiceNumber}</td>
                  <td className="p-3">{inv.patientSnapshot?.name}</td>
                  <td className="p-3">Rs. {inv.total.toLocaleString()}</td>
                  <td className="p-3 text-amber-700">Rs. {Number(inv.discountAmount || 0).toLocaleString()}</td>
                  <td className="p-3">Rs. {inv.amountPaid.toLocaleString()}</td>
                  <td className="p-3 text-red-600">Rs. {inv.dueAmount.toLocaleString()}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="p-3">
                    {inv.createdByName || '-'}
                    {inv.updatedByName && inv.updatedByName !== inv.createdByName && (
                      <div className="text-xs text-slate-400">edited by {inv.updatedByName}</div>
                    )}
                  </td>
                  <td className="p-3">{new Date(inv.createdAt).toLocaleString()}</td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button as={Link} to={`/invoices/${inv.id}/print`} variant="outline" size="xs" icon={Eye}>View/Print</Button>
                      {isAdmin && <Button variant="danger" size="xs" icon={Trash2} onClick={() => remove(inv)}>Delete</Button>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageInfo.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <div>
            Page {page} of {pageInfo.totalPages} &middot; {pageInfo.total} {pageInfo.total === 1 ? 'invoice' : 'invoices'}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => goToPage(page - 1)}>Prev</Button>
            <Button variant="secondary" size="sm" icon={ChevronRight} disabled={page >= pageInfo.totalPages} onClick={() => goToPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </Layout>
  );
}
