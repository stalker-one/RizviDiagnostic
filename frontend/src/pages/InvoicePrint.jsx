import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import PrintThermalInvoice from '../components/PrintThermalInvoice.jsx';
import PrintSimpleInvoice from '../components/PrintSimpleInvoice.jsx';
import Button from '../components/Button.jsx';
import PageLoader from '../components/PageLoader.jsx';
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react';
import api from '../api/axios';

export default function InvoicePrint() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState({});
  const [format, setFormat] = useState('simple'); // 'simple' | 'thermal'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadInvoice() {
      setLoading(true);
      setError('');

      // Load the invoice independently from settings. Previously Promise.all()
      // meant a settings/API failure could make an otherwise valid invoice
      // appear as "Invoice not found". The invoice itself is the required
      // resource; settings are optional print preferences.
      try {
        const response = await api.get(`/invoices/${encodeURIComponent(id)}`);
        if (!cancelled) setInvoice(response.data);
      } catch (err) {
        if (!cancelled) {
          const status = err.response?.status;
          setError(
            status === 404
              ? 'This invoice could not be found. It may not have finished syncing to the live database yet.'
              : status === 401
                ? 'Your session has expired. Please log in again to view this invoice.'
                : 'Unable to load this invoice. Please try again.'
          );
        }
      }

      // Settings must never prevent an invoice from opening/printing.
      try {
        const response = await api.get('/settings');
        if (!cancelled && response.data) {
          setSettings(response.data);
          if (response.data.printFormat === 'thermal') setFormat('thermal');
          if (response.data.printFormat === 'simple') setFormat('simple');
        }
      } catch (err) {
        // Use the safe simple/A4 defaults when settings are temporarily
        // unavailable. Do not replace a successfully loaded invoice with an
        // error state just because settings failed.
        console.warn('[invoice-print] Settings unavailable; using defaults.', err);
      }

      if (!cancelled) setLoading(false);
    }

    loadInvoice();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <Layout title="Invoice"><PageLoader message="Loading invoice..." /></Layout>;

  if (error || !invoice) {
    return (
      <Layout title="Invoice">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Unable to open invoice</h2>
          <p className="text-sm text-slate-500 mb-5">{error || 'Invoice not found.'}</p>
          <div className="flex gap-2">
            <Button as={Link} to="/invoices" variant="secondary" icon={ArrowLeft} size="sm">Back to Invoices</Button>
            <Button variant="outline" icon={RefreshCw} size="sm" onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Invoice ${invoice.invoiceNumber}`}>
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 bg-white rounded-xl border border-slate-100 shadow-sm p-3 sm:p-4">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFormat('simple')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${format === 'simple' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Simple (A4)
          </button>
          <button
            onClick={() => setFormat('thermal')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${format === 'thermal' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Thermal (80mm)
          </button>
        </div>
        <div className="flex gap-2">
          <Button as={Link} to="/invoices" variant="secondary" icon={ArrowLeft} size="sm">Back</Button>
          <Button variant="success" icon={Printer} onClick={() => window.print()} size="sm">Print</Button>
        </div>
      </div>

      <div id="printable-area" className="bg-white rounded-xl border border-slate-100 shadow-sm py-6 overflow-x-auto">
        {format === 'simple' ? (
          <PrintSimpleInvoice invoice={invoice} settings={settings} />
        ) : (
          <PrintThermalInvoice invoice={invoice} settings={settings} />
        )}
      </div>
    </Layout>
  );
}
